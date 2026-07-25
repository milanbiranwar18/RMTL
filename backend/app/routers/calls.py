from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.dependencies import get_current_user_optional
from app.models.user import User
from app.schemas.call import CallCreate, CallUpdate, CallResponse
from app.models.call import Call
from app.services import call_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/calls",
    tags=["calls"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=CallResponse)
def create_call(
    call: CallCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    # Resolving the *caller's* saved telephony Integration (Twilio/Exotel) requires knowing
    # who's calling — falls back to the platform-wide Twilio env vars if not logged in.
    return call_service.create_call(db=db, call=call, user_id=current_user.id if current_user else None)

@router.get("/", response_model=List[CallResponse])
def read_calls(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    calls = call_service.get_calls(db, skip=skip, limit=limit)
    return calls

@router.get("/{call_id}", response_model=CallResponse)
def read_call(call_id: int, db: Session = Depends(get_db)):
    db_call = call_service.get_call(db, call_id=call_id)
    if db_call is None:
        raise HTTPException(status_code=404, detail="Call not found")
    return db_call

from fastapi import Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import json
import httpx
import asyncio

@router.post("/{call_id}/twiml")
async def get_twiml(call_id: int, request: Request, db: Session = Depends(get_db)):
    """Generate TwiML to connect call to WebSocket stream"""
    from twilio.twiml.voice_response import VoiceResponse, Connect
    host = request.headers.get('host')
    response = VoiceResponse()
    connect = Connect()
    scheme = "wss" if request.url.scheme == "https" else "ws"
    connect.stream(url=f'{scheme}://{host}/calls/{call_id}/stream')
    response.append(connect)
    return HTMLResponse(content=str(response), media_type="application/xml")

from app.services import voice_pipeline, telephony_service, dtmf_service
from app.services.dynamic_variables import apply_dynamic_variables
from app.services.workflow_engine import workflow_engine
from app.services.voice_pipeline import resolve_agent_language
from app.models.workflow import Workflow
from app.models.agent import Agent


def _load_workflow_for_agent(db: Session, agent):
    """The saved Workflow for this agent, if any. Live calls follow it node-for-node using the
    exact same engine as the Test panel (`_generate_turn_reply` below) — agents with no saved
    workflow keep behaving exactly as before (one flat LLM prompt, no node graph)."""
    agent_id = getattr(agent, "id", None)
    if not agent_id:
        return None
    return db.query(Workflow).filter(Workflow.agent_id == agent_id).order_by(Workflow.id.desc()).first()


class _WorkflowState:
    """Mutable per-call state threaded through one call's entire turn loop: which workflow
    node the conversation is sitting at, and any variables extracted/passed in along the way
    (Extract Variable / Code nodes, or the call's own `dynamic_variables`)."""

    def __init__(self, db: Session, agent, initial_variables: dict):
        self.db = db
        self.node_id = None
        self.variables = dict(initial_variables or {})
        self.refresh_for_agent(agent)

    def refresh_for_agent(self, agent):
        """Re-point at a different agent's workflow (or lack thereof) — called once at call
        start, and again after an Agent Transfer node hands the conversation to someone else."""
        self.workflow_row = _load_workflow_for_agent(self.db, agent) if agent else None
        self.node_id = None
        self.target_language, _ = resolve_agent_language(agent) if agent else (None, None)


def _generate_turn_reply(agent, transcript: str, conversation_history: list, state: _WorkflowState):
    """Returns (reply_text, ended, action). Walks `agent`'s saved Workflow graph — the same
    engine `POST /test/*` uses — if one exists; otherwise falls back to the old flat
    single-turn reply so agents with no saved workflow are unaffected."""
    if state.workflow_row:
        workflow_data = {
            "nodes": state.workflow_row.nodes,
            "edges": state.workflow_row.edges,
            "target_language": state.target_language,
        }
        result = workflow_engine.execute_workflow(
            workflow_data, transcript, conversation_history, state.node_id, agent, state.variables,
        )
        state.node_id = result.get("node_id")
        state.variables = result.get("variables", state.variables)
        return result.get("response", ""), result.get("ended", False), result.get("action")
    return voice_pipeline.generate_reply(agent, transcript, conversation_history), False, None


async def _perform_call_action(action: dict, db: Session, db_call, agent, state: _WorkflowState):
    """Executes the non-audio side effects of a workflow action (DTMF is handled by the caller,
    since it has to be sent through whichever provider-specific "play audio" mechanism that
    call's loop already uses). Returns the (possibly new, after an Agent Transfer) `agent` to
    keep using for the rest of the call. Twilio is the only provider wired up for real
    Call Transfer / In-Call SMS so far — matches this codebase's established
    provider-by-provider rollout pattern (see telephony_service.py); other providers just log
    a clear "not supported yet" instead of silently doing nothing."""
    kind = action.get("type")
    provider = (getattr(agent, "telephony_provider", None) if agent else None) or "twilio"

    if not db_call and kind in ("call_transfer", "in_call_sms"):
        logger.warning(f"'{kind}' action fired but no Call row is known for this stream — can't resolve credentials/recipient.")
        return agent

    if kind == "call_transfer":
        if provider != "twilio":
            logger.warning(f"Call {db_call.id}: Call Transfer node hit, but provider '{provider}' isn't wired up for real transfers yet — ending call instead.")
            return agent
        from app.services.call_service import _resolve_telephony_credentials
        credentials = _resolve_telephony_credentials(db, db_call.user_id, provider)
        result = telephony_service.transfer_twilio_call(db_call.provider_call_sid, credentials, action.get("target") or "")
        if not result.get("success"):
            logger.error(f"Call {db_call.id}: transfer failed — {result.get('error')}")

    elif kind == "in_call_sms":
        if provider != "twilio":
            logger.warning(f"Call {db_call.id}: In-Call SMS node hit, but provider '{provider}' isn't wired up for real SMS yet.")
            return agent
        from app.services.call_service import _resolve_telephony_credentials
        credentials = _resolve_telephony_credentials(db, db_call.user_id, provider)
        result = telephony_service.send_twilio_sms(credentials, db_call.user_phone, action.get("message") or "")
        if not result.get("success"):
            logger.error(f"Call {db_call.id}: in-call SMS failed — {result.get('error')}")

    elif kind == "agent_transfer":
        target_id = action.get("target_agent_id")
        target_agent = db.query(Agent).filter(Agent.id == target_id).first() if target_id else None
        if target_agent:
            logger.info(f"Call {db_call.id}: handed off from agent {getattr(agent, 'id', '?')} to agent {target_agent.id}")
            state.refresh_for_agent(target_agent)
            return target_agent
        logger.warning(f"Call {db_call.id}: Agent Transfer node pointed at missing agent id={target_id}")

    return agent


async def _run_voice_turn_loop(
    websocket: WebSocket,
    call_label: str,
    agent,
    stream_sid_field: str,
    db: Session,
    db_call,
    initial_variables: dict = None,
    id_in_top_level: bool = False,
    echo_id_on_send: bool = True,
    dtmf_encoding: str = "mulaw",
    dtmf_sample_rate: int = 8000,
):
    """Shared STT->LLM->TTS turn loop for Twilio (`streamSid`, nested in `start`), Exotel
    (`stream_sid`, nested in `start`) and Telnyx (`stream_id`, top-level on every frame —
    `id_in_top_level=True`, and NOT expected back on our outbound frames — `echo_id_on_send=False`,
    see https://developers.telnyx.com/api-reference/websockets/stream-call-media-over-websocket).
    All three otherwise share the same `start` / `media` / `stop` JSON event shape with
    base64 audio payloads at `media.payload`. Plivo and Vonage do NOT reuse this — Plivo's
    outbound event is named `playAudio` (not `media`), and Vonage has no JSON envelope at
    all (raw binary frames) — see `_run_plivo_turn_loop` / `_run_vonage_turn_loop` below."""
    conversation_history = []
    audio_buffer = bytearray()
    stream_sid = None
    state = _WorkflowState(db, agent, initial_variables)

    async def send_audio(audio_base64: str):
        if not audio_base64:
            return
        reply = {"event": "media", "media": {"payload": audio_base64}}
        if echo_id_on_send:
            reply[stream_sid_field] = stream_sid
        await websocket.send_json(reply)

    while True:
        data = await websocket.receive_text()
        msg = json.loads(data)
        event = msg.get('event')

        if event == 'start':
            start = msg.get('start', {})
            stream_sid = (
                msg.get(stream_sid_field) if id_in_top_level
                else start.get(stream_sid_field) or start.get('stream_sid') or start.get('streamSid')
            )
            logger.info(f"{call_label} stream started: {stream_sid} | agent={agent.name if agent else 'none'} | provider={agent.voice_provider if agent else 'default'}")

        elif event == 'media':
            import base64
            payload = msg['media']['payload']
            audio_chunk = base64.b64decode(payload)
            audio_buffer.extend(audio_chunk)

            # Simple MVP turn-taking: once ~2s of audio has buffered, treat it as one turn.
            if len(audio_buffer) > 16000:  # 8kHz mono @ 2 bytes/sample = 16k bytes = 2s
                transcript = await voice_pipeline.transcribe(agent, bytes(audio_buffer))
                audio_buffer.clear()
                logger.info(f"{call_label} transcript: '{transcript}'")

                if transcript.strip():
                    conversation_history.append({"role": "user", "content": transcript})
                    llm_reply, ended, action = _generate_turn_reply(agent, transcript, conversation_history, state)
                    conversation_history.append({"role": "assistant", "content": llm_reply})

                    await send_audio(await voice_pipeline.synthesize(agent, llm_reply))

                    if action and action.get("type") == "press_digit":
                        await send_audio(dtmf_service.generate_dtmf_audio_base64(
                            action.get("digits") or "", sample_rate=dtmf_sample_rate, encoding=dtmf_encoding,
                        ))
                    elif action:
                        agent = await _perform_call_action(action, db, db_call, agent, state)

                    if ended:
                        logger.info(f"{call_label} reached an Ending/Call Transfer node — closing stream")
                        if db_call:
                            db_call.dynamic_variables = state.variables
                            db.commit()
                        break

        elif event == 'stop':
            logger.info(f"{call_label} stream stopped")
            break


async def _run_plivo_turn_loop(websocket: WebSocket, call_label: str, agent, db: Session, db_call, initial_variables: dict = None):
    """Plivo's WS envelope is almost identical to Twilio's for INBOUND frames (`start` /
    `media` / `stop`, base64 `media.payload`), but the OUTBOUND event Plivo expects is named
    `playAudio` (not `media`) with an explicit `contentType`/`sampleRate` alongside the
    payload — see https://plivo.com/docs/voice-agents/audio-streaming/overview."""
    conversation_history = []
    audio_buffer = bytearray()
    state = _WorkflowState(db, agent, initial_variables)

    async def send_audio(audio_base64: str):
        if not audio_base64:
            return
        await websocket.send_json({
            "event": "playAudio",
            "media": {"contentType": "audio/x-mulaw", "sampleRate": 8000, "payload": audio_base64},
        })

    while True:
        data = await websocket.receive_text()
        msg = json.loads(data)
        event = msg.get('event')

        if event == 'start':
            stream_id = msg.get('start', {}).get('streamId')
            logger.info(f"{call_label} stream started: {stream_id} | agent={agent.name if agent else 'none'}")

        elif event == 'media':
            import base64
            audio_chunk = base64.b64decode(msg['media']['payload'])
            audio_buffer.extend(audio_chunk)

            if len(audio_buffer) > 16000:
                transcript = await voice_pipeline.transcribe(agent, bytes(audio_buffer))
                audio_buffer.clear()
                logger.info(f"{call_label} transcript: '{transcript}'")

                if transcript.strip():
                    conversation_history.append({"role": "user", "content": transcript})
                    llm_reply, ended, action = _generate_turn_reply(agent, transcript, conversation_history, state)
                    conversation_history.append({"role": "assistant", "content": llm_reply})

                    await send_audio(await voice_pipeline.synthesize(agent, llm_reply))

                    if action and action.get("type") == "press_digit":
                        await send_audio(dtmf_service.generate_dtmf_audio_base64(
                            action.get("digits") or "", sample_rate=8000, encoding="mulaw",
                        ))
                    elif action:
                        agent = await _perform_call_action(action, db, db_call, agent, state)

                    if ended:
                        if db_call:
                            db_call.dynamic_variables = state.variables
                            db.commit()
                        break

        elif event == 'stop':
            logger.info(f"{call_label} stream stopped")
            break


async def _run_vonage_turn_loop(websocket: WebSocket, call_label: str, agent, db: Session, db_call, initial_variables: dict = None):
    """Vonage's `connect`-to-websocket NCCO action has NO JSON envelope at all — the
    connection carries raw 16-bit/16kHz linear PCM binary frames directly in both directions,
    starting the instant the socket opens and ending when it closes (no `start`/`stop`
    events to key off of). See https://developer.vonage.com/en/voice/voice-api/concepts/websockets."""
    conversation_history = []
    audio_buffer = bytearray()
    state = _WorkflowState(db, agent, initial_variables)
    logger.info(f"{call_label} stream started | agent={agent.name if agent else 'none'}")

    async def send_audio(audio_base64: str):
        if not audio_base64:
            return
        import base64
        await websocket.send_bytes(base64.b64decode(audio_base64))

    while True:
        chunk = await websocket.receive_bytes()
        audio_buffer.extend(chunk)

        # 16kHz mono @ 2 bytes/sample = 32k bytes/sec -> ~2s of audio per turn.
        if len(audio_buffer) > 64000:
            transcript = await voice_pipeline.transcribe(agent, bytes(audio_buffer))
            audio_buffer.clear()
            logger.info(f"{call_label} transcript: '{transcript}'")

            if transcript.strip():
                conversation_history.append({"role": "user", "content": transcript})
                llm_reply, ended, action = _generate_turn_reply(agent, transcript, conversation_history, state)
                conversation_history.append({"role": "assistant", "content": llm_reply})

                await send_audio(await voice_pipeline.synthesize(agent, llm_reply))

                if action and action.get("type") == "press_digit":
                    await send_audio(dtmf_service.generate_dtmf_audio_base64(
                        action.get("digits") or "", sample_rate=16000, encoding="linear16",
                    ))
                elif action:
                    agent = await _perform_call_action(action, db, db_call, agent, state)

                if ended:
                    if db_call:
                        db_call.dynamic_variables = state.variables
                        db.commit()
                    break


async def _finalize_call(db: Session, call_id: int):
    """POST-call bookkeeping: mark the Call completed and fire its webhook (Agent's or
    Call's own), shared by every provider's stream handler."""
    db_call = call_service.get_call(db, call_id=call_id)
    if not db_call:
        return
    webhook_url = getattr(db_call, 'webhook_url', None)
    if not webhook_url and db_call.agent_id:
        try:
            from app.models.agent import Agent
            agent = db.query(Agent).filter(Agent.id == db_call.agent_id).first()
            if agent and getattr(agent, 'webhook_url', None):
                webhook_url = agent.webhook_url
        except Exception:
            pass

    db_call.status = "completed"
    db.commit()

    if webhook_url:
        payload = {
            "call_id": call_id,
            "status": "completed",
            "summary": "This is a placeholder summary for the conversation.",
            "transcript": "Full conversation transcript would be assembled here."
        }
        try:
            asyncio.create_task(httpx.AsyncClient().post(webhook_url, json=payload, timeout=10.0))
            logger.info(f"Dispatched post-call webhook to {webhook_url}")
        except Exception as e:
            logger.error(f"Failed to dispatch webhook: {str(e)}")


@router.websocket("/{call_id}/stream")
async def websocket_stream(websocket: WebSocket, call_id: int, db: Session = Depends(get_db)):
    """Twilio Media Streams handler. Twilio fetches TwiML fresh per call (see /{call_id}/twiml),
    so `call_id` is known up front from the URL path itself."""
    await websocket.accept()

    call = call_service.get_call(db, call_id=call_id)
    agent = call.agent if call and call.agent_id else None
    agent, clean_vars = apply_dynamic_variables(agent, getattr(call, 'dynamic_variables', None))
    if not agent:
        logger.warning(f"Call {call_id} has no associated agent — STT/TTS will use defaults, LLM will use a generic prompt.")

    try:
        await _run_voice_turn_loop(websocket, f"Call {call_id}", agent, stream_sid_field="streamSid", db=db, db_call=call, initial_variables=clean_vars)
    except WebSocketDisconnect:
        logger.info(f"Call {call_id} websocket disconnected")
    finally:
        await _finalize_call(db, call_id)


@router.websocket("/exotel/stream")
async def exotel_websocket_stream(websocket: WebSocket, db: Session = Depends(get_db)):
    """Exotel Voicebot Applet handler.

    Unlike Twilio, Exotel's Voicebot Applet URL is configured **once**, statically, inside a
    Flow in the user's own Exotel dashboard — it can't be templated with our internal call_id
    per call. So every Exotel call from every agent connects to this *same* generic endpoint,
    and we resolve which `Call` (and therefore which Agent/keys/language) it belongs to from the
    `call_sid` Exotel reports in its first `start` event, matched against
    `Call.provider_call_sid` (captured synchronously when we placed the call — see
    telephony_service.initiate_exotel_call).
    """
    await websocket.accept()

    call_id = None
    agent = None
    clean_vars = {}
    try:
        # Peek at the first event ourselves (instead of handing this to _run_voice_turn_loop)
        # purely to resolve `agent` before entering the shared loop — Exotel always sends
        # `start` first, per https://developer.exotel.com/docs/agentstream/developer-guide
        first_raw = await websocket.receive_text()
        first_msg = json.loads(first_raw)
        start = first_msg.get('start', {}) if first_msg.get('event') == 'start' else {}
        provider_call_sid = start.get('call_sid')

        db_call = None
        if provider_call_sid:
            db_call = db.query(Call).filter(Call.provider_call_sid == provider_call_sid).first()
        if not db_call:
            logger.warning(
                f"Exotel stream connected but no Call row matches call_sid={provider_call_sid!r} — "
                "did the Connect API response fail to return a Sid? Falling back to defaults."
            )
        else:
            call_id = db_call.id
            agent = db_call.agent
            agent, clean_vars = apply_dynamic_variables(agent, getattr(db_call, 'dynamic_variables', None))

        stream_sid = start.get('stream_sid')
        logger.info(f"Exotel call {call_id or '[unresolved]'} stream started: {stream_sid} | agent={agent.name if agent else 'none'}")

        await _run_voice_turn_loop(
            websocket, f"Exotel call {call_id or '[unresolved]'}", agent, stream_sid_field="stream_sid",
            db=db, db_call=db_call, initial_variables=clean_vars,
        )
    except WebSocketDisconnect:
        logger.info(f"Exotel call {call_id or '[unresolved]'} websocket disconnected")
    finally:
        if call_id:
            await _finalize_call(db, call_id)


@router.post("/{call_id}/telnyx/webhook")
async def telnyx_webhook(call_id: int, request: Request, db: Session = Depends(get_db)):
    """Telnyx call-event webhook (`call.initiated`/`call.answered`/`call.hangup`/...) — set
    per-call at Dial-time in `telephony_service.initiate_telnyx_call`, so `call_id` is already
    known from the URL path itself (same trick as Twilio's `/twiml` endpoint). We only act on
    `call.hangup` here; the actual conversation happens over `/telnyx/stream` below."""
    try:
        body = await request.json()
        event_type = (body.get("data") or {}).get("event_type")
        if event_type == "call.hangup":
            await _finalize_call(db, call_id)
        logger.info(f"Telnyx webhook for call {call_id}: {event_type}")
    except Exception as e:
        logger.warning(f"Telnyx webhook for call {call_id} — couldn't parse body: {e}")
    return {"received": True}


@router.websocket("/{call_id}/telnyx/stream")
async def telnyx_websocket_stream(websocket: WebSocket, call_id: int, db: Session = Depends(get_db)):
    """Telnyx Media Streaming handler. Like Twilio, `stream_url` is set per-call at Dial-time
    (see telephony_service.initiate_telnyx_call), so `call_id` is already known from the URL."""
    await websocket.accept()
    call = call_service.get_call(db, call_id=call_id)
    agent = call.agent if call and call.agent_id else None
    agent, clean_vars = apply_dynamic_variables(agent, getattr(call, 'dynamic_variables', None))
    if not agent:
        logger.warning(f"Telnyx call {call_id} has no associated agent — STT/TTS will use defaults.")
    try:
        await _run_voice_turn_loop(
            websocket, f"Telnyx call {call_id}", agent,
            stream_sid_field="stream_id", id_in_top_level=True, echo_id_on_send=False,
            db=db, db_call=call, initial_variables=clean_vars,
        )
    except WebSocketDisconnect:
        logger.info(f"Telnyx call {call_id} websocket disconnected")
    finally:
        await _finalize_call(db, call_id)


@router.get("/{call_id}/plivo/answer")
@router.post("/{call_id}/plivo/answer")
async def plivo_answer(call_id: int, request: Request):
    """Plivo fetches this fresh per call (set as `answer_url` in
    telephony_service.initiate_plivo_call), so `call_id` is already known here — same pattern
    as Twilio's /twiml. Returns Plivo XML pointing at our own per-call stream websocket."""
    host = request.headers.get('host')
    scheme = "wss" if request.url.scheme == "https" else "ws"
    stream_url = f"{scheme}://{host}/calls/{call_id}/plivo/stream"
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Response>'
        f'<Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">{stream_url}</Stream>'
        '</Response>'
    )
    return HTMLResponse(content=xml, media_type="application/xml")


@router.websocket("/{call_id}/plivo/stream")
async def plivo_websocket_stream(websocket: WebSocket, call_id: int, db: Session = Depends(get_db)):
    """Plivo Audio Streaming handler — see `_run_plivo_turn_loop` for why this can't reuse the
    shared Twilio/Exotel/Telnyx loop (different outbound event name/shape)."""
    await websocket.accept()
    call = call_service.get_call(db, call_id=call_id)
    agent = call.agent if call and call.agent_id else None
    agent, clean_vars = apply_dynamic_variables(agent, getattr(call, 'dynamic_variables', None))
    if not agent:
        logger.warning(f"Plivo call {call_id} has no associated agent — STT/TTS will use defaults.")
    try:
        await _run_plivo_turn_loop(websocket, f"Plivo call {call_id}", agent, db=db, db_call=call, initial_variables=clean_vars)
    except WebSocketDisconnect:
        logger.info(f"Plivo call {call_id} websocket disconnected")
    finally:
        await _finalize_call(db, call_id)


@router.websocket("/{call_id}/vonage/stream")
async def vonage_websocket_stream(websocket: WebSocket, call_id: int, db: Session = Depends(get_db)):
    """Vonage `connect`-to-websocket handler — see `_run_vonage_turn_loop` for why this is raw
    binary PCM, not JSON. The NCCO pointing here is passed inline at call-creation time in
    telephony_service.initiate_vonage_call, so `call_id` is already known from the URL."""
    await websocket.accept()
    call = call_service.get_call(db, call_id=call_id)
    agent = call.agent if call and call.agent_id else None
    agent, clean_vars = apply_dynamic_variables(agent, getattr(call, 'dynamic_variables', None))
    if not agent:
        logger.warning(f"Vonage call {call_id} has no associated agent — STT/TTS will use defaults.")
    try:
        await _run_vonage_turn_loop(websocket, f"Vonage call {call_id}", agent, db=db, db_call=call, initial_variables=clean_vars)
    except WebSocketDisconnect:
        logger.info(f"Vonage call {call_id} websocket disconnected")
    finally:
        await _finalize_call(db, call_id)

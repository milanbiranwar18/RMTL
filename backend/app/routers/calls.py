from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.dependencies import get_current_user_optional
from app.models.user import User
from app.schemas.call import CallCreate, CallUpdate, CallResponse
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

from app.services import voice_pipeline

@router.websocket("/{call_id}/stream")
async def websocket_stream(websocket: WebSocket, call_id: int, db: Session = Depends(get_db)):
    await websocket.accept()

    # Resolve the agent up front so STT/TTS/LLM all use *this* agent's provider, key, and
    # language for the whole call — previously this handler ignored the agent entirely and
    # always used the platform Sarvam key in Hindi with a hardcoded "You said: X" echo reply.
    call = call_service.get_call(db, call_id=call_id)
    agent = call.agent if call and call.agent_id else None
    if not agent:
        logger.warning(f"Call {call_id} has no associated agent — STT/TTS will use defaults, LLM will use a generic prompt.")

    conversation_history = []
    audio_buffer = bytearray()
    stream_sid = None

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg['event'] == 'start':
                stream_sid = msg['start']['streamSid']
                logger.info(f"Call {call_id} stream started: {stream_sid} | agent={agent.name if agent else 'none'} | provider={agent.voice_provider if agent else 'default'}")

            elif msg['event'] == 'media':
                import base64
                payload = msg['media']['payload']
                audio_chunk = base64.b64decode(payload)
                audio_buffer.extend(audio_chunk)

                # Simple MVP turn-taking: once ~2s of audio has buffered, treat it as one turn.
                if len(audio_buffer) > 16000:  # 8kHz mulaw = 16k bytes = 2s
                    transcript = await voice_pipeline.transcribe(agent, bytes(audio_buffer))
                    audio_buffer.clear()
                    logger.info(f"Call {call_id} transcript: '{transcript}'")

                    if transcript.strip():
                        conversation_history.append({"role": "user", "content": transcript})
                        llm_reply = voice_pipeline.generate_reply(agent, transcript, conversation_history)
                        conversation_history.append({"role": "assistant", "content": llm_reply})

                        audio_base64 = await voice_pipeline.synthesize(agent, llm_reply)
                        if audio_base64:
                            await websocket.send_json({
                                "event": "media",
                                "streamSid": stream_sid,
                                "media": {
                                    "payload": audio_base64
                                }
                            })

            elif msg['event'] == 'stop':
                logger.info(f"Call {call_id} stream stopped")
                break

    except WebSocketDisconnect:
        logger.info(f"Call {call_id} websocket disconnected")
    finally:
        # Evaluate POST-Call webhook feature (like Retell)
        db_call = call_service.get_call(db, call_id=call_id)
        if db_call and hasattr(db_call, 'agent_id'):
            # In a real scenario we'd fetch the Agent details
            pass
            
        # Example triggering a post_call_webhook if present
        # In this minimal replica, we'll imagine it's attached via Call schema
        # A more robust system would async dispatch this via Celery.
        webhook_url = getattr(db_call, 'webhook_url', None) if db_call else None
        if not webhook_url and db_call and hasattr(db_call, 'agent_id'):
             # Try to get from Agent model
             try:
                 from app.models.agent import Agent
                 agent = db.query(Agent).filter(Agent.id == db_call.agent_id).first()
                 if agent and hasattr(agent, 'webhook_url'):
                     webhook_url = agent.webhook_url
             except Exception:
                 pass

        if db_call:
            db_call.status = "completed"
            db.commit()
            
        # Invoke webhook if configured
        if webhook_url:
            payload = {
                "call_id": call_id,
                "status": "completed",
                "summary": "This is a placeholder summary for the conversation.",
                "transcript": "Full conversation transcript would be assembled here."
            }
            try:
                # Use background task or fire and forget
                asyncio.create_task(httpx.AsyncClient().post(webhook_url, json=payload, timeout=10.0))
                print(f"Dispatched post-call webhook to {webhook_url}")
            except Exception as e:
                print(f"Failed to dispatch webhook: {str(e)}")

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.workflow import Workflow
from app.models.agent import Agent
from app.services import voice_pipeline
from app.services.voice_pipeline import workflow_engine, resolve_agent_language
from app.services.dynamic_variables import apply_dynamic_variables
from app.services.workflow_engine import DEFAULT_MODEL_BY_PROVIDER
import logging
import json

router = APIRouter(
    prefix="/test",
    tags=["testing"],
)
logger = logging.getLogger(__name__)

class TestRequest(BaseModel):
    workflow_id: int
    user_input: str
    conversation_history: list = []
    current_node_id: Optional[str] = None
    # e.g. {"language": "Tamil"} — see services/dynamic_variables.py. Lets you test how the
    # agent sounds in a different language without touching its saved default.
    dynamic_variables: Optional[Dict[str, Any]] = None
    # Default True: Custom Function / MCP Tool Call nodes with a mock configured return the
    # mock instead of making a real call — avoids firing a real SMS/Slack message/API side
    # effect every time someone tests a flow. Nodes with no mock configured are unaffected
    # either way (there's nothing to mock, so they always make the real call).
    use_mocks: bool = True

class TestResponse(BaseModel):
    response: str
    node_id: Optional[str] = None
    success: bool = True
    variables: Optional[Dict[str, Any]] = None
    ended: bool = False
    action: Optional[Dict[str, Any]] = None


def _describe_action(action: Optional[Dict[str, Any]]) -> str:
    """Text/voice testing has no real phone line to transfer/text/dial-tone over — so instead
    of silently doing nothing, narrate exactly what a live call would do at this point. Makes
    Call Transfer / Press Digit / In-Call SMS / Agent Transfer nodes actually verifiable from
    the test panel before ever placing a real call."""
    if not action:
        return ""
    kind = action.get("type")
    if kind == "call_transfer":
        return f"\n\n📞 *[Live call would now transfer to {action.get('target') or 'the configured number'}]*"
    if kind == "press_digit":
        return f"\n\n🔢 *[Live call would send DTMF digits: {action.get('digits')}]*"
    if kind == "in_call_sms":
        return f"\n\n💬 *[Live call would send SMS: \"{action.get('message')}\"]*"
    if kind == "agent_transfer":
        return f"\n\n🔀 *[Live call would hand off to agent #{action.get('target_agent_id')}]*"
    return ""


@router.post("/workflow", response_model=TestResponse)
def test_workflow(request: TestRequest, db: Session = Depends(get_db)):
    try:
        logger.info(f"Received test request: {request.dict()}")

        workflow = db.query(Workflow).filter(Workflow.id == request.workflow_id).first()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Get agent settings to know the target language
        agent = None
        if workflow.agent_id:
            agent = db.query(Agent).filter(Agent.id == workflow.agent_id).first()

        # Dynamic variables ({"language": "Tamil", ...}) override the agent's language and
        # substitute into its prompt for THIS test run only — nothing is saved.
        agent, clean_vars = apply_dynamic_variables(agent, request.dynamic_variables)

        # Language is agent-wide now — the LLM should answer in the agent's configured
        # language regardless of which voice provider is doing STT/TTS.
        target_language, _ = resolve_agent_language(agent)

        workflow_data = {
            "nodes": workflow.nodes,
            "edges": workflow.edges,
            "target_language": target_language,
        }

        result = workflow_engine.execute_workflow(
            workflow_data,
            request.user_input,
            request.conversation_history,
            request.current_node_id,
            agent,
            clean_vars,
            use_mocks=request.use_mocks,
        )

        if isinstance(result, dict):
            action = result.get("action")
            return TestResponse(
                response=(result.get("response", "") + _describe_action(action)).strip(),
                node_id=result.get("node_id"),
                success=True,
                variables=result.get("variables", clean_vars),
                ended=result.get("ended", False),
                action=action,
            )
        else:
            return TestResponse(response=str(result), success=False)

    except Exception as e:
        logger.error(f"Workflow execution failed: {str(e)}")
        return TestResponse(response=str(e), success=False)


@router.post("/voice")
async def test_voice_workflow(
    audio: UploadFile = File(...),
    workflow_id: int = Form(...),
    current_node_id: Optional[str] = Form(None),
    conversation_history: str = Form("[]"),
    dynamic_variables: str = Form("{}"),
    use_mocks: bool = Form(True),
    db: Session = Depends(get_db)
):
    try:
        history = json.loads(conversation_history)
        try:
            raw_dynamic_variables = json.loads(dynamic_variables) if dynamic_variables else {}
        except (ValueError, TypeError):
            raw_dynamic_variables = {}

        # 1. Fetch Workflow + Agent
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        agent = None
        if workflow.agent_id:
            agent = db.query(Agent).filter(Agent.id == workflow.agent_id).first()

        # Dynamic variables ({"language": "Tamil", ...}) override the agent's language and
        # substitute into its prompt for THIS test run only — nothing is saved.
        agent, clean_vars = apply_dynamic_variables(agent, raw_dynamic_variables)

        # Language is agent-wide now — applies to the LLM's reply language regardless of
        # which voice provider (Sarvam/ElevenLabs/Whisper) is doing STT/TTS for this agent.
        target_language, _ = resolve_agent_language(agent)

        # 2. Transcribe Audio (Sarvam primary if the agent uses it, Whisper fallback — see voice_pipeline.py)
        audio_content = await audio.read()
        logger.info(f"Audio: {len(audio_content)} bytes | provider={agent.voice_provider if agent else 'whisper'}")

        if len(audio_content) < 100:
            # Empty/silent audio → initial greeting trigger
            transcription = ""
        else:
            transcription = await voice_pipeline.transcribe(agent, audio_content)

        logger.info(f"TRANSCRIPTION: '{transcription}'")

        # 3. Execute Workflow
        workflow_data = {
            "nodes": workflow.nodes,
            "edges": workflow.edges,
            "target_language": target_language,
        }

        result = workflow_engine.execute_workflow(
            workflow_data,
            transcription,
            history,
            current_node_id,
            agent,
            clean_vars,
            use_mocks=use_mocks,
        )

        response_text = ""
        next_node_id = None
        result_variables = clean_vars
        ended = False
        action = None
        if isinstance(result, dict):
            action = result.get("action")
            response_text = result.get("response", "")
            next_node_id = result.get("node_id")
            result_variables = result.get("variables", clean_vars)
            ended = result.get("ended", False)
        else:
            response_text = str(result)

        # 4. Generate Audio (Sarvam primary if the agent uses it, default TTS fallback) — spoken
        # from the plain reply only; the action narration (below) is text-only since it's not
        # meant to be read aloud, just shown in the test transcript.
        audio_base64 = await voice_pipeline.synthesize(agent, response_text)

        return {
            "transcription": transcription,
            "response": (response_text + _describe_action(action)).strip(),
            "audio_base64": audio_base64,
            "node_id": next_node_id,
            "variables": result_variables,
            "ended": ended,
            "action": action,
            "success": True
        }


    except Exception as e:
        logger.error(f"Voice workflow execution failed: {str(e)}")
        return {
            "transcription": "",
            "response": str(e),
            "audio_base64": None,
            "node_id": current_node_id,
            "success": False
        }


class SimulateRequest(BaseModel):
    workflow_id: int
    # Free-form scenario/character description for the AI "caller", e.g. "An impatient customer
    # who wants a refund and is already a bit annoyed" — the whole point of "AI-simulated chat":
    # exercise a whole flow automatically instead of hand-typing every turn yourself.
    persona: str = "A regular customer calling in with a typical, realistic request."
    max_turns: int = 6
    dynamic_variables: Optional[Dict[str, Any]] = None
    use_mocks: bool = True


class SimulateResponse(BaseModel):
    success: bool = True
    transcript: List[Dict[str, str]] = []
    variables: Optional[Dict[str, Any]] = None
    ended: bool = False
    turns_run: int = 0
    error: Optional[str] = None


def _generate_simulated_caller_reply(persona: str, transcript: List[Dict[str, str]], agent) -> Optional[str]:
    """Asks an LLM to play "the caller" for one turn, given the transcript so far — reusing the
    exact same plain chat-completions path every other LLM-assisted node in this file already
    uses (`workflow_engine._try_llm_provider`), just with the roles flipped: from this
    persona-LLM's point of view, the agent's own lines are what it's replying *to* ("user"
    turns), and its own previous lines are "assistant" turns. Returns None once the persona
    thinks the conversation is naturally over (asked to reply with exactly `[END]`), or if no
    LLM key is available at all — either way the simulation just stops there rather than erroring
    out mid-run."""
    system_msg = (
        "You are roleplaying as a caller talking to a phone/chat AI agent, for TESTING "
        f"purposes only. Your persona/scenario: {persona}\n"
        "Reply with ONLY the next thing this caller would naturally say next — one short, "
        "realistic conversational turn. No stage directions, no quotation marks. If the "
        "conversation feels naturally resolved/complete, reply with exactly: [END]"
    )
    messages = [{"role": "system", "content": system_msg}]
    for msg in transcript[-10:]:
        role = "user" if msg["role"] == "assistant" else "assistant"
        messages.append({"role": role, "content": msg["content"]})

    provider = (getattr(agent, "llm_provider", None) if agent else None) or "gpt"
    model = (getattr(agent, "llm_model", None) if agent else None) or DEFAULT_MODEL_BY_PROVIDER.get(provider, "gpt-4o")
    text = workflow_engine._try_llm_provider(provider, model, messages, agent)
    if not text:
        return None
    text = text.strip().strip('"')
    return None if text == "[END]" else text


@router.post("/simulate", response_model=SimulateResponse)
def test_simulate(request: SimulateRequest, db: Session = Depends(get_db)):
    """"AI-simulated chat": runs a whole test conversation automatically — an LLM plays the
    caller (per `persona`), the real workflow engine plays the agent, back and forth, up to
    `max_turns` or until the flow reaches an Ending/Call Transfer, whichever comes first. Lets
    someone verify an entire flow works end-to-end from a single click instead of hand-typing
    every turn through `/test/workflow`."""
    workflow = db.query(Workflow).filter(Workflow.id == request.workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    agent = None
    if workflow.agent_id:
        agent = db.query(Agent).filter(Agent.id == workflow.agent_id).first()
    agent, clean_vars = apply_dynamic_variables(agent, request.dynamic_variables)
    target_language, _ = resolve_agent_language(agent)
    workflow_data = {"nodes": workflow.nodes, "edges": workflow.edges, "target_language": target_language}

    transcript: List[Dict[str, str]] = []
    variables = dict(clean_vars)
    current_node_id = None
    ended = False
    turns_run = 0

    try:
        # Turn 0: the agent's opening line, before the simulated caller has said anything —
        # mirrors how a real call starts (the BEGIN node speaks first).
        result = workflow_engine.execute_workflow(
            workflow_data, "", [], None, agent, variables, use_mocks=request.use_mocks
        )
        transcript.append({"role": "assistant", "content": result.get("response", "")})
        current_node_id = result.get("node_id")
        variables = result.get("variables", variables)
        ended = result.get("ended", False)

        max_turns = max(1, min(request.max_turns, 20))  # hard cap — this is a test tool, not a real call
        for _ in range(max_turns):
            if ended:
                break
            caller_line = _generate_simulated_caller_reply(request.persona, transcript, agent)
            if not caller_line:
                break
            transcript.append({"role": "user", "content": caller_line})
            turns_run += 1

            result = workflow_engine.execute_workflow(
                workflow_data, caller_line, transcript[:-1], current_node_id, agent, variables,
                use_mocks=request.use_mocks,
            )
            transcript.append({"role": "assistant", "content": result.get("response", "")})
            current_node_id = result.get("node_id")
            variables = result.get("variables", variables)
            ended = result.get("ended", False)

        return SimulateResponse(success=True, transcript=transcript, variables=variables, ended=ended, turns_run=turns_run)
    except Exception as e:
        logger.error(f"Simulated chat failed: {e}")
        return SimulateResponse(success=False, transcript=transcript, variables=variables, ended=ended, turns_run=turns_run, error=str(e)[:300])

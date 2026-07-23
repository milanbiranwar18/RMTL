from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.workflow import Workflow
from app.models.agent import Agent
from app.services import voice_pipeline
from app.services.voice_pipeline import workflow_engine, resolve_agent_language
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

class TestResponse(BaseModel):
    response: str
    node_id: Optional[str] = None
    success: bool = True

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
            agent
        )

        if isinstance(result, dict):
            return TestResponse(
                response=result.get("response", ""),
                node_id=result.get("node_id"),
                success=True
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
    db: Session = Depends(get_db)
):
    try:
        history = json.loads(conversation_history)

        # 1. Fetch Workflow + Agent
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        agent = None
        if workflow.agent_id:
            agent = db.query(Agent).filter(Agent.id == workflow.agent_id).first()

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
            agent
        )

        response_text = ""
        next_node_id = None
        if isinstance(result, dict):
            response_text = result.get("response", "")
            next_node_id = result.get("node_id")
        else:
            response_text = str(result)

        # 4. Generate Audio (Sarvam primary if the agent uses it, default TTS fallback)
        audio_base64 = await voice_pipeline.synthesize(agent, response_text)

        return {
            "transcription": transcription,
            "response": response_text,
            "audio_base64": audio_base64,
            "node_id": next_node_id,
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

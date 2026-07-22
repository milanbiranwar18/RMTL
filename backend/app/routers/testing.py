from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services.workflow_engine import WorkflowEngine
from app.services.voice_service import VoiceService
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.workflow import Workflow
from app.models.agent import Agent
import logging
import json
from app.config import settings

router = APIRouter(
    prefix="/test",
    tags=["testing"],
)
logger = logging.getLogger(__name__)
workflow_engine = WorkflowEngine()
voice_service = VoiceService()

LANGUAGE_NAMES = {
    "hi-IN": "Hindi",
    "en-IN": "English (Indian accent)",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "mr-IN": "Marathi",
    "gu-IN": "Gujarati",
    "bn-IN": "Bengali",
    "or-IN": "Odia",
    "pa-IN": "Punjabi",
}

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

        target_language = None
        if agent and agent.voice_provider == 'sarvam':
            lang_code = agent.sarvam_language or 'hi-IN'
            target_language = LANGUAGE_NAMES.get(lang_code, 'Hindi')

        workflow_data = {
            "nodes": workflow.nodes,
            "edges": workflow.edges,
            "target_language": target_language,
        }

        result = workflow_engine.execute_workflow(
            workflow_data,
            request.user_input,
            request.conversation_history,
            request.current_node_id
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

        use_sarvam = agent and agent.voice_provider == 'sarvam'
        sarvam_api_key = agent.sarvam_api_key if agent else None
        sarvam_language = agent.sarvam_language if agent else 'hi-IN'
        sarvam_speaker = agent.voice_name if agent else 'meera'

        target_language = None
        if use_sarvam:
            target_language = LANGUAGE_NAMES.get(sarvam_language, 'Hindi')

        # 2. Transcribe Audio — use Sarvam STT as PRIMARY
        audio_content = await audio.read()
        logger.info(f"Audio: {len(audio_content)} bytes | provider={'sarvam' if use_sarvam else 'whisper'}")

        if len(audio_content) < 100:
            # Empty/silent audio → initial greeting trigger
            transcription = ""
        else:
            transcription = ""
            sarvam_failed = False
            # Resolve STT API key: agent's own → platform key → None
            stt_key = sarvam_api_key or settings.SARVAM_API_KEY
            if stt_key:
                try:
                    transcription = await voice_service.transcribe_audio_sarvam_custom(
                        audio_content, sarvam_language or "hi-IN", api_key=stt_key
                    )
                    logger.info(f"Sarvam STT transcription: '{transcription}'")
                except Exception as stt_err:
                    logger.warning(f"Sarvam STT failed: {stt_err} — skipping")
                    sarvam_failed = True
            else:
                sarvam_failed = True
                    
            # If Sarvam failed (invalid key) or we didn't have a key, try OpenAI Whisper as last resort
            if sarvam_failed:
                try:
                    logger.info("Falling back to Whisper for STT")
                    transcription = await voice_service.transcribe_audio(audio_content)
                except Exception as w_err:
                    logger.error(f"Whisper STT also failed: {w_err}")
                    transcription = ""

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
            current_node_id
        )

        response_text = ""
        next_node_id = None
        if isinstance(result, dict):
            response_text = result.get("response", "")
            next_node_id = result.get("node_id")
        else:
            response_text = str(result)

        # 4. Generate Audio — use Sarvam TTS as PRIMARY
        tts_key = sarvam_api_key or settings.SARVAM_API_KEY
        if tts_key:
            try:
                audio_base64 = await voice_service.generate_audio_sarvam_custom(
                    response_text,
                    sarvam_language or "hi-IN",
                    sarvam_speaker or "meera",
                    api_key=tts_key
                )
            except Exception as tts_err:
                logger.warning(f"Sarvam TTS failed: {tts_err} — falling back to default TTS")
                audio_base64 = await voice_service.generate_audio(response_text)
        else:
            audio_base64 = await voice_service.generate_audio(response_text)

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

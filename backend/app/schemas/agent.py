from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AgentBase(BaseModel):
    name: str
    voice_id: str
    llm_websocket_url: str
    agent_prompt: str
    language: Optional[str] = 'en-US'

    # LLM
    llm_provider: Optional[str] = 'gpt'
    llm_model: Optional[str] = 'gpt-4o'
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None

    # Voice: Text-to-Speech
    voice_provider: Optional[str] = 'elevenlabs'
    voice_name: Optional[str] = 'Rachel'
    elevenlabs_api_key: Optional[str] = None
    cartesia_api_key: Optional[str] = None

    # Voice: Speech-to-Text
    stt_provider: Optional[str] = 'whisper'
    assemblyai_api_key: Optional[str] = None

    # Shared per-vendor keys
    deepgram_api_key: Optional[str] = None
    sarvam_api_key: Optional[str] = None

    # Telephony
    telephony_provider: Optional[str] = 'twilio'

    webhook_url: Optional[str] = None
    sarvam_language: Optional[str] = 'hi-IN'  # Deprecated — superseded by `language`

class AgentCreate(AgentBase):
    pass

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    voice_id: Optional[str] = None
    llm_websocket_url: Optional[str] = None
    agent_prompt: Optional[str] = None
    language: Optional[str] = None

    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None

    voice_provider: Optional[str] = None
    voice_name: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    cartesia_api_key: Optional[str] = None

    stt_provider: Optional[str] = None
    assemblyai_api_key: Optional[str] = None

    deepgram_api_key: Optional[str] = None
    sarvam_api_key: Optional[str] = None

    telephony_provider: Optional[str] = None

    webhook_url: Optional[str] = None
    sarvam_language: Optional[str] = None

class AgentResponse(AgentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

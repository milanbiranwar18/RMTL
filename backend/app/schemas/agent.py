from pydantic import BaseModel, model_validator
from typing import List, Optional
from datetime import datetime

# Every Agent column that holds a per-agent BYOK override key.
KEY_FIELD_NAMES = [
    "openai_api_key", "anthropic_api_key", "gemini_api_key",
    "elevenlabs_api_key", "cartesia_api_key", "assemblyai_api_key",
    "deepgram_api_key", "sarvam_api_key",
]

class AgentBase(BaseModel):
    name: str
    voice_id: str = ''
    # Legacy field from an earlier "pass raw audio straight to the OpenAI Realtime API over a
    # websocket" design. The current pipeline (workflow_engine.py + voice_pipeline.py) does its
    # own STT -> LLM -> TTS turn orchestration instead, so this is never read anywhere anymore —
    # kept only so old rows/integrations that still set it don't break. Not shown in the UI.
    llm_websocket_url: Optional[str] = None
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
    stt_provider: Optional[str] = 'auto'
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
    user_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Which of KEY_FIELD_NAMES have a per-agent override saved — lets the UI show the right
    # "My Own Key" vs "Use Default" toggle state WITHOUT ever sending the actual secret back to
    # the browser (the raw *_api_key fields inherited from AgentBase are masked to None below).
    configured_own_keys: List[str] = []

    class Config:
        from_attributes = True

    @model_validator(mode="after")
    def _mask_keys(self):
        configured = [f for f in KEY_FIELD_NAMES if getattr(self, f, None)]
        for f in KEY_FIELD_NAMES:
            setattr(self, f, None)
        self.configured_own_keys = configured
        return self

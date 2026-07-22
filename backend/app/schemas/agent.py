from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AgentBase(BaseModel):
    name: str
    voice_id: str
    llm_websocket_url: str
    agent_prompt: str
    language: Optional[str] = 'en'
    voice_provider: Optional[str] = 'elevenlabs'
    elevenlabs_api_key: Optional[str] = None
    llm_provider: Optional[str] = 'gpt'
    llm_model: Optional[str] = 'gpt-4o'
    voice_name: Optional[str] = 'Rachel'
    webhook_url: Optional[str] = None

class AgentCreate(AgentBase):
    pass

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    voice_id: Optional[str] = None
    llm_websocket_url: Optional[str] = None
    agent_prompt: Optional[str] = None
    language: Optional[str] = None
    voice_provider: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    voice_name: Optional[str] = None
    webhook_url: Optional[str] = None

class AgentResponse(AgentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True



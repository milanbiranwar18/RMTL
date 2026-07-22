from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base

class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    voice_id = Column(String)
    llm_websocket_url = Column(String)
    agent_prompt = Column(Text)
    language = Column(String, default='en')  # Language code (e.g., 'en', 'es', 'fr', 'hi')
    voice_provider = Column(String, default='elevenlabs')  # 'elevenlabs' or 'whisper'
    elevenlabs_api_key = Column(String, nullable=True)  # Optional ElevenLabs API key
    llm_provider = Column(String, default='gpt')  # 'gpt', 'claude', 'gemini'
    llm_model = Column(String, default='gpt-4o')  # Model version
    voice_name = Column(String, default='Rachel')  # ElevenLabs voice name
    webhook_url = Column(String, nullable=True)  # Post-call webhook URL
    sarvam_api_key = Column(String, nullable=True)  # Sarvam AI API key
    sarvam_language = Column(String, default='hi-IN')  # Sarvam language code
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())



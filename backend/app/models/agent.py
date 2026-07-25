from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    # Nullable for backward compat with agents created before ownership existed — every new
    # agent gets one via routers/agents.py. Used to scope the agent list per-user and to resolve
    # this agent's owner's Integrations vault as a BYOK key fallback (see services/key_resolver.py).
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, index=True)
    voice_id = Column(String)
    llm_websocket_url = Column(String)
    agent_prompt = Column(Text)
    language = Column(String, default='en-US')  # Language code — see services/language_catalog.py

    # ── LLM ──
    llm_provider = Column(String, default='gpt')  # 'gpt', 'claude', 'gemini', 'sarvam'
    llm_model = Column(String, default='gpt-4o')  # Model version
    openai_api_key = Column(String, nullable=True)
    anthropic_api_key = Column(String, nullable=True)
    gemini_api_key = Column(String, nullable=True)

    # ── Voice: Text-to-Speech ──
    voice_provider = Column(String, default='elevenlabs')  # 'elevenlabs', 'sarvam', 'cartesia', 'deepgram_aura', 'openai_tts'
    voice_name = Column(String, default='Rachel')  # Voice/speaker name for whichever TTS provider is selected
    elevenlabs_api_key = Column(String, nullable=True)
    cartesia_api_key = Column(String, nullable=True)

    # ── Voice: Speech-to-Text ──
    stt_provider = Column(String, default='auto')  # 'auto' (recommended), 'deepgram', 'assemblyai', 'sarvam', 'whisper'
    assemblyai_api_key = Column(String, nullable=True)

    # Shared across STT+TTS for the same vendor (one account, one key)
    deepgram_api_key = Column(String, nullable=True)  # Deepgram Nova (STT) + Aura (TTS)
    sarvam_api_key = Column(String, nullable=True)  # Sarvam LLM + STT (Saaras) + TTS (Bulbul)

    # ── Telephony ──
    telephony_provider = Column(String, default='twilio')  # 'twilio', 'exotel', 'telnyx', 'plivo', 'vonage'

    webhook_url = Column(String, nullable=True)  # Post-call webhook URL
    sarvam_language = Column(String, default='hi-IN')  # Deprecated — superseded by `language`, kept for backward compat
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

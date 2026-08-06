"""Usage tracking model for cost analytics and billing."""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UsageRecord(Base):
    """Tracks API usage and costs for each call.
    
    This model captures all API calls made during a conversation:
    - LLM usage (tokens, cost)
    - STT usage (duration, cost)
    - TTS usage (characters, cost)
    - Telephony usage (duration, cost)
    
    Used for:
    - Showing users their API costs
    - Monthly billing reports
    - Cost optimization recommendations
    - Usage analytics and trends
    """
    __tablename__ = "usage_records"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(Integer, ForeignKey("calls.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # LLM Usage
    llm_provider = Column(String, nullable=True)  # gpt, claude, gemini, sarvam
    llm_model = Column(String, nullable=True)  # gpt-4o, claude-sonnet, etc.
    llm_input_tokens = Column(Integer, default=0)
    llm_output_tokens = Column(Integer, default=0)
    llm_cached_tokens = Column(Integer, default=0)  # For providers that support caching
    llm_cost = Column(Float, default=0.0)  # in INR
    
    # STT Usage
    stt_provider = Column(String, nullable=True)  # deepgram, openai, sarvam
    stt_duration_seconds = Column(Integer, default=0)
    stt_cost = Column(Float, default=0.0)  # in INR
    
    # TTS Usage
    tts_provider = Column(String, nullable=True)  # elevenlabs, openai, sarvam, google, azure
    tts_characters = Column(Integer, default=0)
    tts_cost = Column(Float, default=0.0)  # in INR
    
    # Telephony Usage
    telephony_provider = Column(String, nullable=True)  # twilio, exotel, telnyx, plivo, vonage
    telephony_duration_seconds = Column(Integer, default=0)
    telephony_cost = Column(Float, default=0.0)  # in INR
    
    # WhatsApp/SMS/Email Usage
    whatsapp_messages = Column(Integer, default=0)
    whatsapp_cost = Column(Float, default=0.0)  # in INR
    sms_messages = Column(Integer, default=0)
    sms_cost = Column(Float, default=0.0)  # in INR
    email_messages = Column(Integer, default=0)
    email_cost = Column(Float, default=0.0)  # in INR (usually free via SMTP)
    
    # Total Cost
    total_cost = Column(Float, default=0.0, index=True)  # Sum of all costs in INR
    
    # Additional metadata (using 'meta' instead of 'metadata' which is reserved by SQLAlchemy)
    meta = Column(JSON, nullable=True)  # Store any extra info (rate limits hit, retries, etc.)
    
    # Relationships
    call = relationship("Call", back_populates="usage_records")
    
    def calculate_total_cost(self):
        """Calculate and update total cost."""
        self.total_cost = (
            (self.llm_cost or 0) +
            (self.stt_cost or 0) +
            (self.tts_cost or 0) +
            (self.telephony_cost or 0) +
            (self.whatsapp_cost or 0) +
            (self.sms_cost or 0) +
            (self.email_cost or 0)
        )
        return self.total_cost


class PricingConfig(Base):
    """Stores provider pricing configurations.
    
    This table maintains up-to-date pricing for all providers.
    Updated periodically or when providers change pricing.
    """
    __tablename__ = "pricing_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    provider_type = Column(String, index=True)  # llm, stt, tts, telephony, whatsapp, sms
    provider_name = Column(String, index=True)  # openai, sarvam, twilio, etc.
    model_name = Column(String, nullable=True)  # gpt-4o, claude-sonnet, etc.
    
    # Pricing details (stored as JSON for flexibility)
    pricing = Column(JSON)  # Example: {"input_tokens_per_million": 5.0, "output_tokens_per_million": 15.0, "currency": "INR"}
    
    # Metadata
    effective_from = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(String, nullable=True)  # Any special notes about pricing
    
    # Make sure we can query latest pricing easily
    is_active = Column(Integer, default=1, index=True)  # 1=active, 0=deprecated


# Add relationship to Call model (will be added to calls.py)
# call.usage_records = relationship("UsageRecord", back_populates="call")

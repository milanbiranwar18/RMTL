from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class CallStatus(str, enum.Enum):
    QUEUED = "queued"
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"

class Call(Base):
    __tablename__ = "calls"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # who placed the call — used to resolve their telephony Integration credentials
    user_phone = Column(String)
    status = Column(String, default=CallStatus.QUEUED.value)
    # The *provider's* own call identifier (Twilio CallSid / Exotel Call Sid), captured from the
    # synchronous response when we place the call. Exotel's Voicebot Applet URL is configured
    # once (statically) in the user's Flow — it can't contain our internal `call_id` — so when
    # the applet's websocket connects and sends its `start` event, the only way to know which of
    # our `Call` rows (and therefore which Agent/keys/language) it belongs to is to match the
    # `call_sid` it reports against this column.
    provider_call_sid = Column(String, nullable=True, index=True)
    # Arbitrary caller-supplied {"key": "value"} pairs for this one call — substituted into the
    # agent's prompt as `{{key}}`, plus the reserved `language` key overrides which language the
    # agent speaks for this call only. See services/dynamic_variables.py.
    dynamic_variables = Column(JSON, nullable=True)
    recording_url = Column(String, nullable=True)
    transcript = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)

    agent = relationship("Agent")

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class Integration(Base):
    """A user-supplied (BYOK) credential set for one provider within one category.

    Categories: 'llm' | 'stt' | 'tts' | 'telephony'
    Credentials (api key, account sid, tokens, phone numbers, etc.) are stored as a single
    Fernet-encrypted JSON blob — never in plaintext columns. See app/services/crypto_service.py.
    """

    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False, index=True)
    encrypted_credentials = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "category", "provider", name="uq_integration_user_category_provider"),
    )

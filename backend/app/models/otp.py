"""OTP model for email verification and authentication."""

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base


class OTP(Base):
    """Store OTPs for email verification and login.
    
    OTPs are temporary and expire after a certain time.
    Used for:
    - Email verification during registration
    - OTP-based login (passwordless)
    - Password reset
    """
    __tablename__ = "otps"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    otp_code = Column(String, nullable=False)  # 6-digit code
    purpose = Column(String, nullable=False)  # 'registration', 'login', 'reset_password'
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Track verification attempts (prevent brute force)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=5)

"""OTP generation, verification, and email sending service."""

import random
import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.models.otp import OTP
from app.models.user import User

logger = logging.getLogger(__name__)


class OTPService:
    """Service for managing OTPs."""
    
    OTP_LENGTH = 6
    OTP_EXPIRY_MINUTES = 10
    MAX_ATTEMPTS = 5
    
    @staticmethod
    def generate_otp() -> str:
        """Generate a 6-digit OTP code."""
        return ''.join([str(random.randint(0, 9)) for _ in range(OTPService.OTP_LENGTH)])
    
    @staticmethod
    def create_otp(
        db: Session,
        email: str,
        purpose: str = 'login'
    ) -> OTP:
        """Create and store a new OTP.
        
        Args:
            db: Database session
            email: User's email address
            purpose: Purpose of OTP ('registration', 'login', 'reset_password')
            
        Returns:
            OTP object
        """
        # Invalidate any existing OTPs for this email and purpose
        db.query(OTP).filter(
            OTP.email == email,
            OTP.purpose == purpose,
            OTP.is_used == False
        ).update({"is_used": True})
        db.commit()
        
        # Generate new OTP
        otp_code = OTPService.generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=OTPService.OTP_EXPIRY_MINUTES)
        
        otp = OTP(
            email=email,
            otp_code=otp_code,
            purpose=purpose,
            expires_at=expires_at,
            max_attempts=OTPService.MAX_ATTEMPTS
        )
        
        db.add(otp)
        db.commit()
        db.refresh(otp)
        
        logger.info(f"OTP created for {email} (purpose: {purpose})")
        return otp
    
    @staticmethod
    def verify_otp(
        db: Session,
        email: str,
        otp_code: str,
        purpose: str = 'login'
    ) -> tuple[bool, Optional[str]]:
        """Verify an OTP code.
        
        Args:
            db: Database session
            email: User's email address
            otp_code: OTP code to verify
            purpose: Purpose of OTP
            
        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        # Find the most recent unused OTP
        otp = db.query(OTP).filter(
            OTP.email == email,
            OTP.purpose == purpose,
            OTP.is_used == False
        ).order_by(OTP.created_at.desc()).first()
        
        if not otp:
            return False, "No OTP found. Please request a new one."
        
        # Check if OTP has expired
        if datetime.utcnow() > otp.expires_at:
            otp.is_used = True
            db.commit()
            return False, "OTP has expired. Please request a new one."
        
        # Check if max attempts exceeded
        if otp.attempts >= otp.max_attempts:
            otp.is_used = True
            db.commit()
            return False, "Maximum verification attempts exceeded. Please request a new OTP."
        
        # Increment attempts
        otp.attempts += 1
        db.commit()
        
        # Verify OTP code
        if otp.otp_code != otp_code:
            remaining = otp.max_attempts - otp.attempts
            if remaining > 0:
                return False, f"Invalid OTP. {remaining} attempt(s) remaining."
            else:
                otp.is_used = True
                db.commit()
                return False, "Invalid OTP. Maximum attempts exceeded."
        
        # OTP is valid
        otp.is_used = True
        db.commit()
        
        logger.info(f"OTP verified successfully for {email} (purpose: {purpose})")
        return True, None
    
    @staticmethod
    def send_otp_email(email: str, otp_code: str, purpose: str = 'login'):
        """Send OTP via email.
        
        This is a placeholder that logs the OTP. In production, integrate with:
        - SendGrid
        - AWS SES
        - Mailgun
        - Twilio SendGrid
        - etc.
        
        Args:
            email: Recipient email
            otp_code: OTP code to send
            purpose: Purpose of OTP (for email template)
        """
        # TODO: Integrate with actual email service
        # For now, just log it (for development)
        logger.info(f"📧 OTP Email to {email}: {otp_code} (purpose: {purpose})")
        
        # In production, you would do something like:
        # from sendgrid import SendGridAPIClient
        # from sendgrid.helpers.mail import Mail
        # 
        # message = Mail(
        #     from_email='noreply@rmvox.com',
        #     to_emails=email,
        #     subject='Your RMVox OTP Code',
        #     html_content=f'<strong>Your OTP is: {otp_code}</strong><br>Valid for 10 minutes.'
        # )
        # sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
        # response = sg.send(message)
        
        print(f"\n{'='*50}")
        print(f"📧 OTP CODE FOR {email}")
        print(f"{'='*50}")
        print(f"Code: {otp_code}")
        print(f"Purpose: {purpose}")
        print(f"Valid for: {OTPService.OTP_EXPIRY_MINUTES} minutes")
        print(f"{'='*50}\n")
        
        return True
    
    @staticmethod
    def send_otp_sms(phone: str, otp_code: str, purpose: str = 'login'):
        """Send OTP via SMS.
        
        This is a placeholder. In production, integrate with:
        - Twilio
        - AWS SNS
        - Nexmo/Vonage
        - Plivo
        - etc.
        
        Args:
            phone: Recipient phone number
            otp_code: OTP code to send
            purpose: Purpose of OTP
        """
        # TODO: Integrate with actual SMS service
        logger.info(f"📱 OTP SMS to {phone}: {otp_code} (purpose: {purpose})")
        
        print(f"\n{'='*50}")
        print(f"📱 OTP CODE FOR {phone}")
        print(f"{'='*50}")
        print(f"Code: {otp_code}")
        print(f"Purpose: {purpose}")
        print(f"Valid for: {OTPService.OTP_EXPIRY_MINUTES} minutes")
        print(f"{'='*50}\n")
        
        return True
    
    @staticmethod
    def cleanup_expired_otps(db: Session):
        """Clean up expired OTPs from database.
        
        This should be run periodically (e.g., via a cron job or background task).
        
        Args:
            db: Database session
        """
        deleted_count = db.query(OTP).filter(
            OTP.expires_at < datetime.utcnow()
        ).delete()
        db.commit()
        
        logger.info(f"Cleaned up {deleted_count} expired OTPs")
        return deleted_count

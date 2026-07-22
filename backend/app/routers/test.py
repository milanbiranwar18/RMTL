from fastapi import APIRouter
from app.services.twilio_service import initiate_call
from app.config import settings

router = APIRouter(
    prefix="/test",
    tags=["test"],
)

@router.get("/twilio")
def test_twilio():
    """Test Twilio credentials"""
    try:
        # Try to initiate a test call
        result = initiate_call("+918698494714", "Test")
        
        return {
            "twilio_configured": True,
            "account_sid": settings.TWILIO_ACCOUNT_SID[:10] + "...",
            "phone_number": settings.TWILIO_PHONE_NUMBER,
            "test_result": result
        }
    except Exception as e:
        return {
            "twilio_configured": False,
            "error": str(e),
            "error_type": type(e).__name__
        }

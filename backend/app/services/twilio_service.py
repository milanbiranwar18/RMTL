from twilio.rest import Client
from app.config import settings
import logging

logger = logging.getLogger(__name__)

def initiate_call(to_phone: str, agent_prompt: str):
    """
    Initiate a phone call using Twilio
    """
    try:
        logger.info(f"Attempting to initiate call to {to_phone}")
        logger.info(f"Using Twilio Account SID: {settings.TWILIO_ACCOUNT_SID[:10]}...")
        
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        
        # Create a call
        call = client.calls.create(
            to=to_phone,
            from_=settings.TWILIO_PHONE_NUMBER,
            url='http://demo.twilio.com/docs/voice.xml',  # TwiML URL for call handling
            status_callback='http://your-backend-url/calls/status',  # Callback for status updates
        )
        
        logger.info(f"Call initiated successfully. SID: {call.sid}, Status: {call.status}")
        return {
            'success': True,
            'call_sid': call.sid,
            'status': call.status
        }
    except Exception as e:
        logger.error(f"Failed to initiate Twilio call: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        return {
            'success': False,
            'error': str(e)
        }

def get_call_status(call_sid: str):
    """
    Get the status of a Twilio call
    """
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        call = client.calls(call_sid).fetch()
        
        return {
            'status': call.status,
            'duration': call.duration,
            'direction': call.direction
        }
    except Exception as e:
        logger.error(f"Failed to get call status: {str(e)}")
        return {
            'error': str(e)
        }

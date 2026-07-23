from sqlalchemy.orm import Session
from app.models.call import Call, CallStatus
from app.models.agent import Agent
from app.schemas.call import CallCreate, CallUpdate
from app.services import telephony_service, integration_service
from app.config import settings
import logging

logger = logging.getLogger(__name__)


def _resolve_telephony_credentials(db: Session, user_id: int, provider: str) -> dict:
    """The calling user's own saved Integration credentials for this provider — falling back
    to the platform-wide Twilio env vars only (the one provider that historically had global
    settings; everything else requires the user to connect their own account)."""
    creds = None
    if user_id:
        creds = integration_service.get_credentials(db, user_id, "telephony", provider)
    if creds:
        return creds
    if provider == "twilio" and settings.TWILIO_ACCOUNT_SID:
        return {
            "account_sid": settings.TWILIO_ACCOUNT_SID,
            "auth_token": settings.TWILIO_AUTH_TOKEN,
            "phone_number": settings.TWILIO_PHONE_NUMBER,
        }
    return {}


def create_call(db: Session, call: CallCreate, user_id: int = None):
    # Create call record in database
    db_call = Call(**call.dict(), user_id=user_id, status=CallStatus.QUEUED.value)
    db.add(db_call)
    db.commit()
    db.refresh(db_call)

    agent = db.query(Agent).filter(Agent.id == db_call.agent_id).first()
    provider = (agent.telephony_provider if agent else None) or "twilio"
    credentials = _resolve_telephony_credentials(db, user_id, provider)

    try:
        logger.info(f"Initiating {provider} call for call_id={db_call.id} via user_id={user_id}")
        result = telephony_service.initiate_call(provider, db_call.id, call.user_phone, credentials)

        if result.get('success'):
            logger.info(f"Call initiated successfully: {result}")
            db_call.status = CallStatus.ACTIVE.value
        else:
            logger.error(f"{provider} call failed: {result.get('error')}")
            db_call.status = CallStatus.FAILED.value
        db.commit()
        db.refresh(db_call)
    except Exception as e:
        logger.error(f"Exception during {provider} call initiation: {str(e)}")
        db_call.status = CallStatus.FAILED.value
        db.commit()
        db.refresh(db_call)

    return db_call

def get_call(db: Session, call_id: int):
    return db.query(Call).filter(Call.id == call_id).first()

def get_calls(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Call).offset(skip).limit(limit).all()

def update_call(db: Session, call_id: int, call: CallUpdate):
    db_call = get_call(db, call_id)
    if not db_call:
        return None
    
    update_data = call.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_call, key, value)
    
    db.add(db_call)
    db.commit()
    db.refresh(db_call)
    return db_call

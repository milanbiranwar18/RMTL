from sqlalchemy.orm import Session
from app.models.call import Call, CallStatus
from app.schemas.call import CallCreate, CallUpdate
from app.services.twilio_service import initiate_call
import logging

logger = logging.getLogger(__name__)

def create_call(db: Session, call: CallCreate):
    # Create call record in database
    db_call = Call(**call.dict(), status=CallStatus.QUEUED.value)
    db.add(db_call)
    db.commit()
    db.refresh(db_call)
    
    # Initiate actual Twilio call
    try:
        logger.info(f"Attempting to initiate call for call_id={db_call.id}")
        result = initiate_call(call.user_phone, "Agent prompt here")
        
        if result.get('success'):
            logger.info(f"Call initiated successfully: {result}")
            db_call.status = CallStatus.ACTIVE.value
            db.commit()
            db.refresh(db_call)
        else:
            logger.error(f"Twilio call failed: {result.get('error')}")
            db_call.status = CallStatus.FAILED.value
            db.commit()
            db.refresh(db_call)
    except Exception as e:
        logger.error(f"Exception during Twilio call initiation: {str(e)}")
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

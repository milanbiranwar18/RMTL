from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.call import CallStatus

class CallBase(BaseModel):
    agent_id: str
    customer_number: str

class CallCreate(CallBase):
    pass

class CallResponse(CallBase):
    call_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: Optional[int] = None
    audio_url: Optional[str] = None
    status: CallStatus

    class Config:
        orm_mode = True

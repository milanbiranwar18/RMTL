from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CallBase(BaseModel):
    agent_id: int
    user_phone: str

class CallCreate(CallBase):
    pass

class CallUpdate(BaseModel):
    status: Optional[str] = None
    recording_url: Optional[str] = None
    transcript: Optional[str] = None
    end_time: Optional[datetime] = None

class CallResponse(CallBase):
    id: int
    status: str
    recording_url: Optional[str] = None
    transcript: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None

    class Config:
        from_attributes = True

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class CallBase(BaseModel):
    agent_id: int
    user_phone: str
    # Optional call-time overrides, e.g. {"language": "Hindi", "customer_name": "Rohan"} — see
    # services/dynamic_variables.py. `language` is a reserved key that overrides the agent's
    # spoken language for this call only, no matter what language its prompt is written in.
    dynamic_variables: Optional[Dict[str, Any]] = None

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

from pydantic import BaseModel

class TranscriptBase(BaseModel):
    role: str
    content: str
    start_timestamp: int
    end_timestamp: int

class TranscriptCreate(TranscriptBase):
    call_id: str

class TranscriptResponse(TranscriptBase):
    id: int

    class Config:
        orm_mode = True

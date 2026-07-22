from pydantic import BaseModel
from typing import List, Optional

class AnalysisBase(BaseModel):
    summary: Optional[str] = None
    sentiment: Optional[str] = None
    topics: Optional[List[str]] = None
    action_items: Optional[List[str]] = None

class AnalysisCreate(AnalysisBase):
    call_id: str

class AnalysisResponse(AnalysisBase):
    id: int

    class Config:
        orm_mode = True

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class IntegrationCreate(BaseModel):
    category: str  # llm | stt | tts | telephony
    provider: str
    credentials: Dict[str, Any]


class IntegrationResponse(BaseModel):
    id: int
    category: str
    provider: str
    masked_credentials: Dict[str, str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

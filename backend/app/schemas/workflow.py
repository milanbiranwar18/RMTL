from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    agent_id: int

class WorkflowCreate(WorkflowBase):
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None

class WorkflowResponse(WorkflowBase):
    id: int
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    is_active: bool
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

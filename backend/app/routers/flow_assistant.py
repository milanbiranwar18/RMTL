import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import Agent
from app.services import flow_assistant_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["flow-assistant"])


class AssistantEditRequest(BaseModel):
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    message: str
    conversation_history: List[Dict[str, str]] = []
    agent_id: Optional[int] = None


class AssistantEditResponse(BaseModel):
    success: bool = True
    reply: str = ""
    operations: List[Dict[str, Any]] = []


@router.post("/edit", response_model=AssistantEditResponse)
def edit_workflow(request: AssistantEditRequest, db: Session = Depends(get_db)):
    """The "Conductor"-style chat assistant in the Workflow Builder — takes the graph currently
    on the canvas (not necessarily saved yet) plus a plain-English instruction, and proposes graph
    operations for the frontend to apply. Stateless: the canvas (in the browser) is always the
    source of truth, this just proposes edits to it."""
    agent = db.query(Agent).filter(Agent.id == request.agent_id).first() if request.agent_id else None

    other_agents = []
    if request.agent_id:
        other_agents = [
            {"id": a.id, "name": a.name}
            for a in db.query(Agent).filter(Agent.id != request.agent_id).limit(20).all()
        ]

    result = flow_assistant_service.generate_operations(
        request.nodes, request.edges, request.message, request.conversation_history, agent, other_agents
    )
    return AssistantEditResponse(success=True, reply=result["reply"], operations=result["operations"])

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse
from app.services import agent_service
from app.services.language_catalog import LANGUAGE_GROUPS

router = APIRouter(
    prefix="/agents",
    tags=["agents"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=AgentResponse)
def create_agent(
    agent: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return agent_service.create_agent(db=db, agent=agent, user_id=current_user.id)

@router.get("/", response_model=List[AgentResponse])
def read_agents(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Only this user's own agents — agents are BYOK-scoped per account (their Integrations
    vault is used as a key fallback for whichever agents they own), so a shared platform-wide
    agent list would leak one user's configured providers/keys into another's view."""
    return agent_service.get_agents(db, user_id=current_user.id, skip=skip, limit=limit)

# Must be declared before /{agent_id} — otherwise "languages" would be swallowed by that
# parameterized route and fail int conversion instead of matching here.
@router.get("/languages")
def get_supported_languages():
    """Every language an agent can be configured to speak, grouped by region. Drives the
    Language dropdown on the Agent create/settings pages so the list lives in one place."""
    return LANGUAGE_GROUPS

@router.get("/{agent_id}", response_model=AgentResponse)
def read_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_agent = agent_service.get_agent(db, agent_id=agent_id)
    if db_agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if db_agent.user_id is not None and db_agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
    return db_agent

@router.put("/{agent_id}", response_model=AgentResponse)
@router.patch("/{agent_id}", response_model=AgentResponse)
def update_agent(
    agent_id: int,
    agent: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = agent_service.get_agent(db, agent_id=agent_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if existing.user_id is not None and existing.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
    db_agent = agent_service.update_agent(db, agent_id=agent_id, agent=agent)
    if db_agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return db_agent

@router.delete("/{agent_id}")
def delete_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = agent_service.get_agent(db, agent_id=agent_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if existing.user_id is not None and existing.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent_service.delete_agent(db, agent_id=agent_id)
    return {"success": True}

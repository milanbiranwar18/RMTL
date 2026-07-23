from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse
from app.services import agent_service
from app.services.language_catalog import LANGUAGE_GROUPS

router = APIRouter(
    prefix="/agents",
    tags=["agents"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=AgentResponse)
def create_agent(agent: AgentCreate, db: Session = Depends(get_db)):
    return agent_service.create_agent(db=db, agent=agent)

@router.get("/", response_model=List[AgentResponse])
def read_agents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    agents = agent_service.get_agents(db, skip=skip, limit=limit)
    return agents

# Must be declared before /{agent_id} — otherwise "languages" would be swallowed by that
# parameterized route and fail int conversion instead of matching here.
@router.get("/languages")
def get_supported_languages():
    """Every language an agent can be configured to speak, grouped by region. Drives the
    Language dropdown on the Agent create/settings pages so the list lives in one place."""
    return LANGUAGE_GROUPS

@router.get("/{agent_id}", response_model=AgentResponse)
def read_agent(agent_id: int, db: Session = Depends(get_db)):
    db_agent = agent_service.get_agent(db, agent_id=agent_id)
    if db_agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return db_agent

@router.put("/{agent_id}", response_model=AgentResponse)
@router.patch("/{agent_id}", response_model=AgentResponse)
def update_agent(agent_id: int, agent: AgentUpdate, db: Session = Depends(get_db)):
    db_agent = agent_service.update_agent(db, agent_id=agent_id, agent=agent)
    if db_agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return db_agent

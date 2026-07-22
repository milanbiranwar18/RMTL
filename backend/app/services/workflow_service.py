from sqlalchemy.orm import Session
from app.models.workflow import Workflow
from app.schemas.workflow import WorkflowCreate, WorkflowUpdate

def create_workflow(db: Session, workflow: WorkflowCreate):
    db_workflow = Workflow(**workflow.dict())
    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    return db_workflow

def get_workflow(db: Session, workflow_id: int):
    return db.query(Workflow).filter(Workflow.id == workflow_id).first()

def get_workflows(db: Session, agent_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(Workflow)
    if agent_id:
        query = query.filter(Workflow.agent_id == agent_id)
    return query.offset(skip).limit(limit).all()

def update_workflow(db: Session, workflow_id: int, workflow: WorkflowUpdate):
    db_workflow = get_workflow(db, workflow_id)
    if not db_workflow:
        return None
    
    update_data = workflow.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_workflow, key, value)
    
    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    return db_workflow

def delete_workflow(db: Session, workflow_id: int):
    db_workflow = get_workflow(db, workflow_id)
    if db_workflow:
        db.delete(db_workflow)
        db.commit()
    return db_workflow

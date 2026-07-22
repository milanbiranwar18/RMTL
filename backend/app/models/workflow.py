from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.sql import func
from app.database import Base

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    
    # Store the flow structure as JSON
    nodes = Column(JSON, default=[])
    edges = Column(JSON, default=[])
    
    is_active = Column(Boolean, default=False)
    version = Column(Integer, default=1)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

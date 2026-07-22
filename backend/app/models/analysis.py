from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from app.database import Base

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(String, ForeignKey("calls.call_id"))
    summary = Column(String)
    sentiment = Column(String)
    topics = Column(JSON)
    action_items = Column(JSON)

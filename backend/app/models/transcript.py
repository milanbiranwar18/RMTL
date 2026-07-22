from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(String, ForeignKey("calls.call_id"))
    role = Column(String)  # agent or customer
    content = Column(Text)
    start_timestamp = Column(Integer) # milliseconds
    end_timestamp = Column(Integer) # milliseconds

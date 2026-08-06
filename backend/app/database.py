from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

from pathlib import Path

# Ensure relative SQLite paths always resolve to backend/app.db regardless of CWD
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite:///") and not db_url.startswith("sqlite:////"):
    rel_path = db_url.replace("sqlite:///", "")
    backend_dir = Path(__file__).resolve().parent.parent
    abs_db_path = (backend_dir / rel_path).resolve()
    db_url = f"sqlite:///{abs_db_path}"

SQLALCHEMY_DATABASE_URL = db_url

_connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

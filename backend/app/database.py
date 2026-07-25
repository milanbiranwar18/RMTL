from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# Swapping DATABASE_URL to a Postgres URL (e.g. Neon's `postgresql://...?sslmode=require`) is the
# *only* code change needed to move off SQLite — psycopg2 is already in requirements.txt, and
# `Base.metadata.create_all()` (main.py) builds the full schema on first startup against
# whichever database this points to. The two engine options below only matter for that switch:
# - `pool_pre_ping=True`: serverless Postgres (Neon included) can silently close idle
#   connections; without this, the *next* query on a stale connection fails outright instead of
#   SQLAlchemy transparently reconnecting first. Harmless no-op for SQLite.
# - `check_same_thread=False`: SQLite-only — FastAPI's sync route handlers each run in their own
#   worker thread, and SQLite's default same-thread check would otherwise reject that.
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

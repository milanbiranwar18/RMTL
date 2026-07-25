from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import agents, calls, test, workflows, testing, auth, integrations, telephony, mcp, flow_assistant

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="RMVox API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router)
app.include_router(calls.router)
app.include_router(test.router)
app.include_router(workflows.router)
app.include_router(testing.router)
app.include_router(auth.router)
app.include_router(integrations.router)
app.include_router(telephony.router)
app.include_router(mcp.router)
app.include_router(flow_assistant.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to RM Vox AI"}

# Trigger reload (frontend logging added)

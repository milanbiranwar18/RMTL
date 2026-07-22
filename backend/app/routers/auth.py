from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

# In-memory mock database for now
_mock_users = {}

@router.post("/register")
def register(req: RegisterRequest):
    if req.email in _mock_users:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Store plain for mock purposes
    _mock_users[req.email] = {
        "name": req.name,
        "email": req.email,
        "password": req.password
    }
    
    return {
        "token": f"mock-token-{req.email}",
        "user": {
            "name": req.name,
            "email": req.email
        }
    }

@router.post("/login")
def login(req: LoginRequest):
    user = _mock_users.get(req.email)
    
    # Temporary fallback: if email not found, let them in anyway just for demo testing, 
    # but use the provided email. Or we can force registration. Lets force registration.
    if not user or user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    return {
        "token": f"mock-token-{req.email}",
        "user": {
            "name": user["name"],
            "email": user["email"]
        }
    }

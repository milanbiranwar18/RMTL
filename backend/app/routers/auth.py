from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import AuthResponse, LoginRequest, RegisterRequest
from app.services import security_service
from app.services.otp_service import OTPService
from app.services.oauth_service import OAuthService

router = APIRouter(prefix="/auth", tags=["auth"])


# Request/Response models
class SendOTPRequest(BaseModel):
    email: EmailStr
    purpose: str = 'login'  # 'login', 'registration', 'reset_password'


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str
    purpose: str = 'login'


class OTPResponse(BaseModel):
    message: str
    expires_in_minutes: int


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str
    new_password: str


class GoogleSignInRequest(BaseModel):
    token: str  # Google access token from frontend


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = User(
        name=req.name,
        email=req.email,
        hashed_password=security_service.hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = security_service.create_access_token({"sub": str(user.id)})
    return {"token": token, "user": {"name": user.name, "email": user.email}}


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not security_service.verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = security_service.create_access_token({"sub": str(user.id)})
    return {"token": token, "user": {"name": user.name, "email": user.email}}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "profile_picture": current_user.profile_picture,
        "is_email_verified": current_user.is_email_verified,
        "oauth_provider": current_user.oauth_provider
    }


# OTP Endpoints

@router.post("/otp/send", response_model=OTPResponse)
def send_otp(req: SendOTPRequest, db: Session = Depends(get_db)):
    """Send OTP to user's email.
    
    Purpose can be:
    - 'login': For OTP-based login
    - 'registration': For email verification during signup
    - 'reset_password': For password reset
    """
    # For registration, check if email exists
    if req.purpose == 'registration':
        existing = db.query(User).filter(User.email == req.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    # For login and reset_password, check if email exists
    if req.purpose in ('login', 'reset_password'):
        user = db.query(User).filter(User.email == req.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="No account found with this email")
    
    # Create OTP
    otp = OTPService.create_otp(db, req.email, req.purpose)
    
    # Send OTP via email
    OTPService.send_otp_email(req.email, otp.otp_code, req.purpose)
    
    return {
        "message": "OTP sent successfully to your email",
        "expires_in_minutes": OTPService.OTP_EXPIRY_MINUTES
    }


@router.post("/otp/verify", response_model=AuthResponse)
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Verify OTP and log in user (if purpose is 'login').
    
    For 'login' purpose: Returns auth token
    For other purposes: Just verifies the OTP
    """
    # Verify OTP
    success, error = OTPService.verify_otp(db, req.email, req.otp_code, req.purpose)
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    # For login purpose, authenticate user
    if req.purpose == 'login':
        user = db.query(User).filter(User.email == req.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Mark email as verified
        if not user.is_email_verified:
            user.is_email_verified = True
            db.commit()
        
        token = security_service.create_access_token({"sub": str(user.id)})
        return {
            "token": token,
            "user": {
                "name": user.name,
                "email": user.email,
                "profile_picture": user.profile_picture
            }
        }
    
    # For registration or reset_password, just confirm verification
    return {
        "token": None,
        "user": {"name": "", "email": req.email},
        "message": "OTP verified successfully"
    }


@router.post("/otp/login", response_model=OTPResponse)
def otp_login_request(req: SendOTPRequest, db: Session = Depends(get_db)):
    """Request OTP for passwordless login."""
    req.purpose = 'login'
    return send_otp(req, db)


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset user password using verified OTP."""
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    success, error = OTPService.verify_otp(db, req.email, req.otp_code, "reset_password")
    if not success:
        raise HTTPException(status_code=400, detail=error)

    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = security_service.hash_password(req.new_password)
    db.commit()

    return {"message": "Password reset successfully. You can now log in with your new password."}


# OAuth Endpoints

@router.post("/google/signin", response_model=AuthResponse)
async def google_signin(req: GoogleSignInRequest, db: Session = Depends(get_db)):
    """Sign in or sign up with Google OAuth.
    
    Frontend should use Google Sign-In library to get the token,
    then send it to this endpoint.
    """
    user, token_or_error = await OAuthService.google_signin(db, req.token)
    
    if not user:
        raise HTTPException(status_code=401, detail=token_or_error)
    
    return {
        "token": token_or_error,
        "user": {
            "name": user.name,
            "email": user.email,
            "profile_picture": user.profile_picture
        }
    }

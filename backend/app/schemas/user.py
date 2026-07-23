from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class UserPublic(BaseModel):
    name: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: UserPublic

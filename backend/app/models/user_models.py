from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
import uuid

class UserBase(BaseModel):
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

class UserRegister(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class User(UserBase):
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hashed_password: Optional[str] = None   # None for Google-only accounts
    google_id: Optional[str] = None
    total_xp: int = 0
    level: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

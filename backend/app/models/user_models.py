from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class UserBase(BaseModel):
    username: str
    age: Optional[int] = None

class UserCreate(UserBase):
    pass

class User(UserBase):
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    total_xp: int = 0
    level: int = 1
    expedition_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

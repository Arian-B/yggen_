from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class ExpeditionBase(BaseModel):
    user_id: str
    root_topic: str

class ExpeditionCreate(ExpeditionBase):
    pass

class Expedition(ExpeditionBase):
    expedition_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    state: str = "active"
    global_xp_earned: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    depth_left_max: int = 0
    depth_right_max: int = 0

    class Config:
        from_attributes = True

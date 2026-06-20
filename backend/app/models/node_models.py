from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

class NodeBase(BaseModel):
    expedition_id: str
    topic: str
    level: int
    parent_node_id: Optional[str] = None
    primary_domain: str
    secondary_domains: List[str] = []
    # Wikipedia-specific fields
    wikipedia_url: Optional[str] = None
    summary: Optional[str] = None       # Short Wikipedia intro summary
    link_type: Optional[str] = None     # "embedded_link" | "see_also_link" | None (root)

class NodeCreate(NodeBase):
    pass

class Node(NodeBase):
    node_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    difficulty_score: int = 10
    abstraction_score: int = 10
    content_version: str = "1.0"
    content: Optional[str] = None       # Full Wikipedia article text (lazy loaded)
    sources: List[str] = []
    last_generated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed: bool = False

    class Config:
        from_attributes = True


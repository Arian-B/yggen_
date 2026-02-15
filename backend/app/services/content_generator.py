from typing import Dict, Any
from app.services.ai_engine import ai_engine

class ContentGenerator:
    async def generate_node_content(self, topic: str, difficulty_score: int, abstraction_score: int, expedition_id: str = None) -> Dict[str, Any]:
        """
        Delegates content generation to AIEngine.
        """
        return await ai_engine.generate_content(topic, difficulty_score, abstraction_score, expedition_id)

content_generator = ContentGenerator()

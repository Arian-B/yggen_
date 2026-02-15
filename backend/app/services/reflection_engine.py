from typing import Dict, Any
from app.services.ai_engine import ai_engine

class ReflectionEngine:
    def should_trigger_reflection(self, node_level: int, abstraction_score: int) -> bool:
        """
        Determines if a reflection limit has been reached.
        Kept local as it's logic, not AI.
        """
        if abs(node_level) >= 2:
            return True
        
        if abstraction_score > 70:
            return True
        
        return False

    async def evaluate_reflection_answer(self, node_topic: str, user_answer: str, expedition_id: str = None) -> Dict[str, Any]:
        """
        Delegates reflection evaluation to AIEngine.
        """
        return await ai_engine.evaluate_reflection(node_topic, user_answer, expedition_id)

reflection_engine = ReflectionEngine()

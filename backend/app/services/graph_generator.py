from typing import Dict, Any
from app.services.ai_engine import ai_engine

class GraphGenerator:
    async def generate_initial_graph(self, root_topic: str, expedition_id: str = None) -> Dict[str, Any]:
        """
        Delegates graph generation to AIEngine.
        """
        return await ai_engine.generate_graph(root_topic, expedition_id)

graph_generator = GraphGenerator()

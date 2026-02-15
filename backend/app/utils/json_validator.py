import json
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class JSONValidator:
    """
    Validates AI-generated JSON against expected schemas and business rules.
    """

    @staticmethod
    def validate_graph_structure(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates the output of GraphGenerator.
        Required keys: root, prerequisites, advanced.
        """
        required_keys = ["root", "prerequisites", "advanced"]
        for key in required_keys:
            if key not in data:
                raise ValueError(f"Missing required key in graph: {key}")
        
        # Validate root
        if not isinstance(data.get("root"), dict):
            raise ValueError("Root node must be a dictionary")
            
        # Validate lists
        if not isinstance(data.get("prerequisites"), list):
            raise ValueError("Prerequisites must be a list")
            
        if not isinstance(data.get("advanced"), list):
            raise ValueError("Advanced nodes must be a list")
            
        return data

    @staticmethod
    def validate_content_structure(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates the output of ContentGenerator.
        Required keys: content, sources.
        """
        if "content" not in data or "sources" not in data:
            raise ValueError("Missing content or sources in generated content")
            
        if not isinstance(data["content"], str):
             raise ValueError("Content must be a string")
             
        if not isinstance(data["sources"], list):
             raise ValueError("Sources must be a list")
             
        return data

    @staticmethod
    def validate_reflection_structure(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates output of ReflectionEngine.
        Required keys: score, feedback.
        """
        if "score" not in data or "feedback" not in data:
            raise ValueError("Missing score or feedback in reflection evaluation")
            
        if not isinstance(data["score"], (int, float)):
            raise ValueError("Score must be a number")
            
        return data

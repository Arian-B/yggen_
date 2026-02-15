from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseProvider(ABC):
    """
    Abstract base class for all AI providers.
    Enforces a common interface for text generation and JSON structured output.
    """

    @abstractmethod
    async def generate_text(self, system_prompt: str, user_prompt: str, model: str = None) -> str:
        """
        Generates raw text response.
        """
        pass

    @abstractmethod
    async def generate_json(self, system_prompt: str, user_prompt: str, schema: Dict[str, Any] = None, model: str = None) -> Dict[str, Any]:
        """
        Generates proper JSON object response.
        """
        pass

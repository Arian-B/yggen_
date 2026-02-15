from typing import Tuple
from app.core.config import settings

class ModelRouter:
    def get_provider_config(self, task_type: str) -> Tuple[str, str]:
        """
        Returns (provider_name, model_name) based on task type.
        Providers: 'gemini', 'groq', 'openrouter'
        """
        if task_type == "structure":
            # Gemini is great for structured JSON
            return "gemini", settings.DEFAULT_SMART_MODEL
        
        elif task_type == "longform":
            # Groq/Llama3 for fast content, or Gemini for long context
            # Let's use Gemini for quality longform
            return "gemini", settings.DEFAULT_SMART_MODEL
            
        elif task_type == "validation":
            # Fast model needed
            return "groq", settings.DEFAULT_FAST_MODEL
            
        elif task_type == "summary":
            return "groq", settings.DEFAULT_FAST_MODEL
            
        else:
            # Default fallback
            return "openrouter", settings.DEFAULT_FALLBACK_MODEL
            
model_router = ModelRouter()

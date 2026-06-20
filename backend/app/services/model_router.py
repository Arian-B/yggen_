from typing import Tuple
from app.core.config import settings

class ModelRouter:
    def get_provider_config(self, task_type: str) -> Tuple[str, str]:
        """
        Returns (provider_name, model_name) based on task type.
        Providers: 'gemini', 'groq', 'openrouter'
        
        NOTE: Gemini free tier quota is exhausted.
              Groq (llama-3.3-70b-versatile) is the active primary provider.
              Switch back to 'gemini' if a paid API key is added.
        """
        if task_type == "structure":
            # Groq/Llama3 handles JSON graph generation well
            return "groq", settings.DEFAULT_FAST_MODEL
        
        elif task_type == "longform":
            # Groq/Llama3 for fast, quality content generation
            return "groq", settings.DEFAULT_FAST_MODEL
            
        elif task_type == "validation":
            # Fast model needed for scoring reflections
            return "groq", settings.DEFAULT_FAST_MODEL
            
        elif task_type == "summary":
            return "groq", settings.DEFAULT_FAST_MODEL
            
        else:
            # Default fallback
            return "openrouter", settings.DEFAULT_FALLBACK_MODEL
            
model_router = ModelRouter()

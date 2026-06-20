import json
import httpx
from typing import Dict, Any, Optional
from app.services.providers.base_provider import BaseProvider

class OllamaProvider(BaseProvider):
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url

    async def generate_text(self, system_prompt: str, user_prompt: str, model: str = None) -> str:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model or "llama3",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["message"]["content"]
        except Exception as e:
            raise RuntimeError(f"Ollama text generation failed: {e}")

    async def generate_json(self, system_prompt: str, user_prompt: str, schema: Dict[str, Any] = None, model: str = None) -> Dict[str, Any]:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model or "llama3",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "format": "json",
            "stream": False
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                content = data["message"]["content"]
                return json.loads(content)
        except Exception as e:
            raise RuntimeError(f"Ollama json generation failed: {e}")

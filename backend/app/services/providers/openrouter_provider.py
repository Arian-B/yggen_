from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from app.core.config import settings
from app.services.providers.base_provider import BaseProvider

class OpenRouterProvider(BaseProvider):
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = "https://openrouter.ai/api/v1"
        
    def _get_llm(self, model: str = None, temperature: float = 0.3, json_mode: bool = False):
        kwargs = {}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
            
        return ChatOpenAI(
            model=model or settings.DEFAULT_FALLBACK_MODEL,
            api_key=self.api_key,
            base_url=self.base_url,
            temperature=temperature,
            model_kwargs=kwargs,
            max_retries=0
        )

    async def generate_text(self, system_prompt: str, user_prompt: str, model: str = None) -> str:
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", user_prompt)
        ])
        llm = self._get_llm(model=model)
        chain = prompt | llm | StrOutputParser()
        return await chain.ainvoke({})

    async def generate_json(self, system_prompt: str, user_prompt: str, schema: Dict[str, Any] = None, model: str = None) -> Dict[str, Any]:
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", user_prompt)
        ])
        llm = self._get_llm(model=model, json_mode=True)
        chain = prompt | llm | JsonOutputParser()
        return await chain.ainvoke({})

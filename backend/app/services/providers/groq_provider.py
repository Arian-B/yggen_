from typing import Dict, Any
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from app.core.config import settings
from app.services.providers.base_provider import BaseProvider

class GroqProvider(BaseProvider):
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        
    def _get_llm(self, model: str = None, temperature: float = 0.3, json_mode: bool = False):
        kwargs = {}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
            
        return ChatGroq(
            model_name=model or settings.DEFAULT_FAST_MODEL,
            groq_api_key=self.api_key,
            temperature=temperature,
            model_kwargs=kwargs
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

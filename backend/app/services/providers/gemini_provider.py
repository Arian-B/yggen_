from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from app.core.config import settings
from app.services.providers.base_provider import BaseProvider

class GeminiProvider(BaseProvider):
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        
    def _get_llm(self, model: str = None, temperature: float = 0.3):
        return ChatGoogleGenerativeAI(
            model=model or settings.DEFAULT_SMART_MODEL,
            google_api_key=self.api_key,
            temperature=temperature,
            convert_system_message_to_human=True,
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
        
        # for JSON mode in Gemini, we can just ask for it or use structure output if available.
        # LangChain's ChatGoogleGenerativeAI supports '.with_structured_output' or we rely on prompt eng + JsonOutputParser
        # Using JsonOutputParser for generic compatibility
        llm = self._get_llm(model=model)
        chain = prompt | llm | JsonOutputParser()
        return await chain.ainvoke({})

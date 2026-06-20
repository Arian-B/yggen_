import logging
import json
import time
from typing import Dict, Any, List, Optional
from app.database.connection import db
from app.services.model_router import model_router
from app.utils.json_validator import JSONValidator
from app.services.providers.gemini_provider import GeminiProvider
from app.services.providers.groq_provider import GroqProvider
from app.services.providers.openrouter_provider import OpenRouterProvider

from app.services.providers.ollama_provider import OllamaProvider

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIEngine:
    def __init__(self):
        self.providers = {
            "gemini": GeminiProvider(),
            "groq": GroqProvider(),
            "openrouter": OpenRouterProvider(),
            "ollama": OllamaProvider()
        }
        self.max_retries = 2

    def _fetch_expedition_context(self, expedition_id: str) -> str:
        """
        Fetches a compressed snapshot of the expedition state to inject into AI context.
        """
        try:
            # Fetch Expedition Details
            expedition = db.db.collection('expeditions').get(expedition_id)
            
            if not expedition:
                return "Context: Unknown Expedition."

            # Fetch All Nodes (Lightweight)
            nodes_cursor = db.db.aql.execute(
                """
                FOR n IN nodes 
                FILTER n.expedition_id == @id 
                SORT n.level ASC
                RETURN {topic: n.topic, level: n.level, domain: n.primary_domain}
                """,
                bind_vars={"id": expedition_id}
            )
            nodes = list(nodes_cursor)

            # Summarize
            context_summary = {
                "root_topic": expedition.get("root_topic"),
                "total_nodes": len(nodes),
                "current_structure": nodes
            }
            
            return f"EXPEDITION CONTEXT: {json.dumps(context_summary, indent=None)}"
        except Exception as e:
            logger.error(f"Error fetching context: {e}")
            return "Context: Unavailable due to error."

    async def _execute_with_retry(self, provider_name: str, model_name: str, method: str, **kwargs) -> Any:
        """
        Executes AI call with retry logic and fallback.
        """
        provider = self.providers.get(provider_name)
        if not provider:
            logger.warning(f"Provider {provider_name} not found, falling back to Groq")
            provider = self.providers["groq"]

        for attempt in range(self.max_retries + 1):
            try:
                start_time = time.time()
                if method == "json":
                    response = await provider.generate_json(model=model_name, **kwargs)
                else:
                    response = await provider.generate_text(model=model_name, **kwargs)
                
                duration = time.time() - start_time
                logger.info(f"AI Success: {provider_name} ({duration:.2f}s)")
                return response

            except Exception as e:
                logger.warning(f"AI Attempt {attempt+1} failed ({provider_name}): {e}")
                if attempt == self.max_retries:
                    # If primary fails, try fallback chain (Gemini -> Groq -> OpenRouter)
                    fallback_chain = ["groq", "openrouter"] if provider_name == "gemini" else ["openrouter"]
                    for fallback_name in fallback_chain:
                        if fallback_name == provider_name:
                            continue
                        logger.warning(f"Switching to FALLBACK provider: {fallback_name}")
                        try:
                            fallback_provider = self.providers[fallback_name]
                            if method == "json":
                                return await fallback_provider.generate_json(**kwargs)
                            else:
                                return await fallback_provider.generate_text(**kwargs)
                        except Exception as fb_e:
                            logger.error(f"Fallback to {fallback_name} failed: {fb_e}")
                    raise e

    async def generate_graph(self, root_topic: str, expedition_id: str = None) -> Dict[str, Any]:
        """
        Generates a knowledge graph structure.
        """
        # 1. Context
        context_str = ""
        if expedition_id:
            context_str = self._fetch_expedition_context(expedition_id)

        # 2. Select Provider
        provider_name, model_name = model_router.get_provider_config("structure")
        
        # 3. Prompt Construction
        system_prompt = f"""
        You are an expert curriculum designer and knowledge graph architect.
        Your task is to generate a structured knowledge graph for a given topic.
        {context_str}
        
        Rules:
        1. Root Node: Level 0.
        2. Prerequisites: Level -1. Max 4 items. Must be direct fundamental dependencies.
        3. Advanced: Level 1. Max 4 items. Must be direct logical next steps.
        4. Domains: Assign a primary_domain (e.g. Physics, History, Math) and empty secondary_domains list.
        5. Scores: Assign difficulty_score (1-100) and abstraction_score (1-100) logically.
        6. No duplicates. No skipping levels.
        7. Strict JSON output.
        
        Output Schema:
        {{
          "root": {{ "topic": "Topic Name", "level": 0, "primary_domain": "Domain", "secondary_domains": [], "difficulty_score": 50, "abstraction_score": 50 }},
          "prerequisites": [ {{ "topic": "Name", "level": -1, "primary_domain": "Domain", "secondary_domains": [], "difficulty_score": 40, "abstraction_score": 40 }} ],
          "advanced": [ {{ "topic": "Name", "level": 1, "primary_domain": "Domain", "secondary_domains": [], "difficulty_score": 60, "abstraction_score": 60 }} ],
          "cross_links": []
        }}
        """
        user_prompt = f"Generate the knowledge graph for the topic: {root_topic}"

        # 4. Execute
        response = await self._execute_with_retry(
            provider_name, 
            model_name, 
            "json", 
            system_prompt=system_prompt, 
            user_prompt=user_prompt
        )

        # 5. Validate
        return JSONValidator.validate_graph_structure(response)

    async def generate_content(self, topic: str, difficulty: int, abstraction: int, expedition_id: str = None) -> Dict[str, Any]:
        """
        Generates educational content.
        """
        context_str = ""
        if expedition_id:
            context_str = self._fetch_expedition_context(expedition_id)

        provider_name, model_name = model_router.get_provider_config("longform")

        system_prompt = f"""
        You are a world-class educator and textbook author.
        Your task is to generate high-quality, structured educational content for a specific topic.
        {context_str}
        
        Rules:
        1. Content Length: 800-1200 words.
        2. Tone: Academic yet accessible.
        3. Structure: Use Markdown formatting (## Subheadings, **Bold**, Lists).
        4. Citations: Provide a list of real, verifiable sources (URLs). Use Wikipedia format if unsure.
        5. Adaptation: Adjust complexity based on difficulty_score (1-100) and abstraction_score (1-100).
           - High difficulty: More technical depth, formal language.
           - High abstraction: More theoretical, conceptual links.
        6. JSON Output:
           {{
             "content": "Markdown string...",
             "sources": ["url1", "url2"]
           }}
        """
        
        user_prompt = f"""
        Topic: {topic}
        Difficulty: {difficulty}/100
        Abstraction: {abstraction}/100
        
        Generate the content now.
        """

        response = await self._execute_with_retry(
             provider_name,
             model_name,
             "json",
             system_prompt=system_prompt,
             user_prompt=user_prompt
        )
        
        return JSONValidator.validate_content_structure(response)

    async def evaluate_reflection(self, topic: str, user_answer: str, expedition_id: str = None) -> Dict[str, Any]:
        """
        Evaluates user reflection.
        """
        context_str = ""
        if expedition_id:
             context_str = self._fetch_expedition_context(expedition_id)

        provider_name, model_name = model_router.get_provider_config("validation")
        
        system_prompt = f"""
        You are a tutor evaluating a student's understanding.
        {context_str}
        
        Rules:
        1. Context: The student just learned about the given topic.
        2. Task: Score their reflection/answer (0-100) and provide brief feedback.
        3. Pass Threshold: 60 (Meaning they understood the core concept).
        4. JSON Output:
           {{
             "score": 85,
             "feedback": "Good understanding of..."
           }}
        """
        
        user_prompt = f"""
        Topic: {topic}
        Student Answer: {user_answer}
        
        Evaluate now.
        """
        
        response = await self._execute_with_retry(
            provider_name,
            model_name,
            "json",
            system_prompt=system_prompt,
            user_prompt=user_prompt
        )
        
        return JSONValidator.validate_reflection_structure(response)

    async def generate_polymath_content(self, topic: str, wiki_text: str) -> str:
        """
        Synthesizes Wikipedia raw text into structured polymathic markdown content (fallback).
        """
        provider_name, model_name = model_router.get_provider_config("longform")
        
        system_prompt = f"""You are a world-class polymath, researcher, and educator.
Your task is to take raw Wikipedia article text for "{topic}" and rewrite/summarize it into a comprehensive, beautifully structured Markdown document.

Rules:
1. Maintain the exact same section and subsection hierarchy (using #, ##, ### headers) as the original Wikipedia article.
2. EXCLUDE the "References", "See Also", "External Links", "Further Reading", and similar metadata sections.
3. For each section, write a detailed, highly informative, polymathic summary. Explain concepts with depth.
4. APPEND a final major section:
   ## Beyond Wikipedia: Deep Dive & Insights
   In this section, provide:
   - Extra information and context from across the internet that the Wikipedia page might lack.
   - 3-5 interesting and mind-blowing fun facts about the topic.
   - Most important general knowledge and takeaways.
5. The output must be pure Markdown (no code block wrappers, just raw text).
"""
        user_prompt = f"Raw Wikipedia text for '{topic}':\n\n{wiki_text[:8000]}\n\nProduce the polymathic markdown content."

        return await self._execute_with_retry(
            provider_name,
            model_name,
            "text",
            system_prompt=system_prompt,
            user_prompt=user_prompt
        )

ai_engine = AIEngine()

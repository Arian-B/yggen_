import re
import logging
from typing import List, Dict, Any
from datetime import datetime

from app.database.connection import db
from app.services.wikipedia_service import wikipedia_service
from app.services.content_agent import content_agent
from app.services.ai_engine import ai_engine
from app.services.model_router import model_router

logger = logging.getLogger(__name__)

class ETLPipeline:
    def clean_citations(self, text: str) -> str:
        """
        TRANSFORM step: Cleans Wikipedia citation tags, e.g. [1], [2], [citation needed].
        """
        if not text:
            return ""
        # Remove bracketed numbers: [1], [22]
        text = re.sub(r'\[\d+\]', '', text)
        # Remove [citation needed] or [edit]
        text = re.sub(r'\[citation needed\]', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\[edit\]', '', text, flags=re.IGNORECASE)
        return text.strip()

    async def extract_entities(self, topic: str, content: str) -> List[str]:
        """
        TRANSFORM step: Uses a fast LLM model to extract core technical terms and concepts.
        """
        provider_name, model_name = model_router.get_provider_config("validation")
        provider = ai_engine.providers.get(provider_name) or ai_engine.providers["openrouter"]
        
        system_prompt = """You are a Data Engineering NLP transformer.
Given an article topic and raw text content, extract 4 to 8 key subtopics, technical concepts, or domains related to this topic.
Format your output as a strict JSON list of strings, for example: ["Quantum Tunneling", "Wave Function", "Superposition"].
Output JSON only, do not write code block tags, wrappers, or any introductory text."""
        
        user_prompt = f"Topic: {topic}\n\nSnippet:\n{content[:2000]}\n\nExtract key concepts:"
        
        try:
            result = await provider.generate_json(system_prompt=system_prompt, user_prompt=user_prompt)
            if isinstance(result, list):
                return result
            elif isinstance(result, dict):
                # Check potential keys the model might return
                for key in ["entities", "concepts", "terms", "list"]:
                    if key in result and isinstance(result[key], list):
                        return result[key]
            return []
        except Exception as e:
            logger.warning(f"NLP entity extraction failed: {str(e)}")
            return []

    async def run_pipeline(self, node_id: str, topic: str) -> Dict[str, Any]:
        """
        Orchestrates the ETL Pipeline for a specific node topic.
        """
        logger.info(f"ETL PIPELINE starting for topic: {topic} (Node: {node_id})")
        
        # 1. EXTRACT
        logger.info("ETL: [EXTRACT] fetching Wikipedia content metadata...")
        page_data = wikipedia_service.get_page(topic)
        wikipedia_url = page_data.get("url") if page_data else None
        wiki_text = page_data.get("full_text", "") if page_data else ""
        wiki_summary = page_data.get("summary", "") if page_data else ""
        
        # 2. TRANSFORM
        cleaned_wiki_text = self.clean_citations(wiki_text)
        
        # Run agentic LLM summarization (calls wikipedia + web search tools)
        try:
            polymath_markdown = await content_agent.run_agent(topic)
        except Exception as e:
            logger.warning(f"LangChain content agent failed, falling back to raw Wikipedia content: {str(e)}")
            # Fallback formatting of raw Wikipedia text/summary into structured Markdown
            sections = []
            sections.append(f"# {topic}\n")
            if wiki_summary:
                sections.append(f"## Summary\n{wiki_summary}\n")
            if cleaned_wiki_text:
                sections.append(f"## Overview\n{cleaned_wiki_text[:4000]}\n")
            else:
                sections.append("\nNo additional content is available for this topic.\n")
            
            sections.append("\n> [!NOTE]\n> *You are viewing raw Wikipedia content. The AI Content Agent is currently offline (API key invalid/missing or quota exceeded).*")
            polymath_markdown = "\n".join(sections)
        
        # Clean the generated markdown
        polymath_markdown = self.clean_citations(polymath_markdown)
        
        # Extract metadata entities
        entities = await self.extract_entities(topic, cleaned_wiki_text or polymath_markdown)
        
        # 3. LOAD
        logger.info("ETL: [LOAD] loading structured content into ArangoDB...")
        try:
            node_doc = db.db.collection('nodes').get(node_id)
            if not node_doc:
                raise ValueError(f"Target node {node_id} not found in DB")
                
            update_data = {
                "content": polymath_markdown,
                "content_version": "2.0",
                "sources": [wikipedia_url] if wikipedia_url else [],
                "wikipedia_url": wikipedia_url,
                "summary": wiki_summary[:500],
                "secondary_domains": entities,
                "last_generated_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            db.db.collection('nodes').update({**node_doc, **update_data})
            logger.info("ETL PIPELINE completed successfully.")
            return {**node_doc, **update_data}
        except Exception as e:
            logger.error(f"ETL: [LOAD] failed to write to DB: {str(e)}")
            raise e

    async def save_content(
        self,
        node_id: str,
        content: str,
        wiki_summary: str = "",
        wikipedia_url: str = None,
    ) -> None:
        """
        Saves fully-accumulated streamed content to ArangoDB.
        Called by the SSE streaming endpoint once all chunks have been emitted.
        """
        logger.info(f"ETL: [SAVE] persisting streamed content for node {node_id}")
        try:
            node_doc = db.db.collection('nodes').get(node_id)
            if not node_doc:
                logger.warning(f"ETL: [SAVE] node {node_id} not found, skipping save")
                return

            # Extract entities from the finished content (best-effort)
            topic = node_doc.get("topic", "")
            entities = await self.extract_entities(topic, content[:2000])

            update_data = {
                "content": content,
                "content_version": "2.0",
                "sources": [wikipedia_url] if wikipedia_url else [],
                "wikipedia_url": wikipedia_url,
                "summary": wiki_summary[:500] if wiki_summary else node_doc.get("summary", ""),
                "secondary_domains": entities,
                "last_generated_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            db.db.collection('nodes').update({**node_doc, **update_data})
            logger.info(f"ETL: [SAVE] node {node_id} saved successfully")
        except Exception as e:
            logger.error(f"ETL: [SAVE] failed for node {node_id}: {e}")

etl_pipeline = ETLPipeline()

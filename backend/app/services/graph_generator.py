from typing import Dict, Any, List
import logging
from app.services.wikipedia_service import wikipedia_service

logger = logging.getLogger(__name__)

class GraphGenerator:
    """
    Builds knowledge graphs directly from Wikipedia page link structures.
    No AI generation of topics — all graph structure comes from real Wikipedia data.
    """

    async def generate_initial_graph(self, root_topic: str) -> Dict[str, Any]:
        """
        Fetches the Wikipedia page for root_topic and builds the initial
        graph structure from its embedded links and 'See Also' sections.
        """
        logger.info(f"Building wiki graph for: {root_topic}")

        # 1. Fetch root page
        page_data = wikipedia_service.get_page(root_topic)
        if not page_data:
            raise ValueError(f"Wikipedia page not found for topic: '{root_topic}'")

        # 2. Extract links
        links = wikipedia_service.get_page_links(root_topic)

        # 3. Determine Wikipedia category
        category = wikipedia_service.get_clean_category(page_data.get("categories", []))

        # 4. Build graph structure mirroring the original schema
        root_node = {
            "topic": page_data["title"],
            "level": 0,
            "primary_domain": category,   # kept for backward compat
            "category": category,
            "secondary_domains": [],
            "difficulty_score": 50,
            "abstraction_score": 50,
            "wikipedia_url": page_data["url"],
            "summary": page_data["summary"][:500] if page_data.get("summary") else ""
        }

        # Try to get suggested prerequisites using AI Engine
        prereq_nodes = []
        try:
            from app.services.ai_engine import ai_engine
            ai_graph = await ai_engine.generate_graph(root_node["topic"])
            ai_prereqs = ai_graph.get("prerequisites", [])
            for prereq in ai_prereqs[:3]:  # Cap to 3 prerequisites
                title = prereq.get("topic")
                if title:
                    # Verify availability on real Wikipedia API
                    p_data = wikipedia_service.get_page(title)
                    if p_data:
                        prereq_nodes.append({
                            "topic": p_data["title"],
                            "level": -1,
                            "primary_domain": prereq.get("primary_domain") or category,
                            "secondary_domains": [],
                            "difficulty_score": prereq.get("difficulty_score", 40),
                            "abstraction_score": prereq.get("abstraction_score", 40),
                            "wikipedia_url": p_data["url"],
                            "summary": p_data["summary"][:500] if p_data.get("summary") else "",
                            "link_type": "prerequisite"
                        })
        except Exception as e:
            logger.warning(f"Failed to generate prerequisites via AI: {e}")

        # Embedded links become "advanced_of" connections (level +1)
        advanced_nodes = []
        for title in links["embedded_links"][:8]:  # Cap to 8 for initial graph
            advanced_nodes.append({
                "topic": title,
                "level": 1,
                "primary_domain": category,
                "secondary_domains": [],
                "difficulty_score": 55,
                "abstraction_score": 55,
                "link_type": "embedded_link"
            })

        # See Also links become "see_also" connections (level +1, separate type)
        see_also_nodes = []
        for title in links["see_also_links"]:
            see_also_nodes.append({
                "topic": title,
                "level": 1,
                "primary_domain": category,
                "secondary_domains": [],
                "difficulty_score": 50,
                "abstraction_score": 50,
                "link_type": "see_also_link"
            })

        return {
            "root": root_node,
            "prerequisites": prereq_nodes,
            "advanced": advanced_nodes,
            "cross_links": see_also_nodes
        }


graph_generator = GraphGenerator()

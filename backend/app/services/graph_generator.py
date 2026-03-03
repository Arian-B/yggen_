from typing import Dict, Any, List
import logging
from app.services.wikipedia_service import wikipedia_service

logger = logging.getLogger(__name__)

class GraphGenerator:
    """
    Builds knowledge graphs directly from Wikipedia page link structures.
    No AI generation of topics — all graph structure comes from real Wikipedia data.
    """

    def generate_initial_graph(self, root_topic: str) -> Dict[str, Any]:
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

        # 3. Determine domain
        domain = wikipedia_service.get_primary_domain(page_data.get("categories", []))

        # 4. Build graph structure mirroring the original schema
        root_node = {
            "topic": page_data["title"],
            "level": 0,
            "primary_domain": domain,
            "secondary_domains": [],
            "difficulty_score": 50,
            "abstraction_score": 50,
            "wikipedia_url": page_data["url"],
            "summary": page_data["summary"][:500] if page_data.get("summary") else ""
        }

        # Embedded links become "advanced_of" connections (level +1)
        advanced_nodes = []
        for title in links["embedded_links"][:8]:  # Cap to 8 for initial graph
            advanced_nodes.append({
                "topic": title,
                "level": 1,
                "primary_domain": domain,
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
                "primary_domain": domain,
                "secondary_domains": [],
                "difficulty_score": 50,
                "abstraction_score": 50,
                "link_type": "see_also_link"
            })

        return {
            "root": root_node,
            "prerequisites": [],   # Not applicable for Wikipedia sourcing at this stage
            "advanced": advanced_nodes,
            "cross_links": see_also_nodes
        }


graph_generator = GraphGenerator()

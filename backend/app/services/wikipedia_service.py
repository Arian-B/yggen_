import logging
import re
from typing import Optional
import wikipediaapi
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

class WikipediaService:
    """
    Core integration with the Wikipedia API.
    Fetches page content, embedded links, and "See Also" relations.
    All content sourced from Wikipedia; AI is used only for summarization.
    """

    def __init__(self):
        self.wiki = wikipediaapi.Wikipedia(
            language="en",
            user_agent="wikiyggen_/1.0 (https://github.com/Arian-B/yggen_; contact@wikiyggen.dev)"
        )

    def get_page(self, title: str) -> Optional[dict]:
        """
        Fetches a Wikipedia page and returns structured data.
        Returns None if the page does not exist.
        """
        page = self.wiki.page(title)
        if not page.exists():
            logger.warning(f"Wikipedia page not found: {title}")
            return None

        logger.info(f"Fetched Wikipedia page: {page.title}")
        return {
            "title": page.title,
            "summary": page.summary,
            "full_text": page.text,
            "url": page.fullurl,
            "categories": [cat for cat in page.categories.keys()],
        }

    def get_page_links(self, title: str) -> dict:
        """
        Extracts embedded hyperlinks and "See Also" links from a Wikipedia page.
        Returns two categorized lists:
        - embedded_links: Links found inside the main article text.
        - see_also_links: Links from the "See Also" section.
        """
        page = self.wiki.page(title)
        if not page.exists():
            return {"embedded_links": [], "see_also_links": []}

        all_links = list(page.links.keys())

        # Heuristic: Find "See Also" section links by checking section titles
        see_also_titles = set()
        for section in page.sections:
            if "see also" in section.title.lower():
                # The links within this section
                section_text = section.text
                for link_title in all_links:
                    if link_title in section_text:
                        see_also_titles.add(link_title)

        # Embedded links = all links NOT in see_also
        # We cap both lists to avoid massive graphs
        see_also_links = list(see_also_titles)[:10]
        embedded_links = [l for l in all_links if l not in see_also_titles][:20]

        logger.info(f"Extracted {len(embedded_links)} embedded links and {len(see_also_links)} see_also links for '{title}'")
        return {
            "embedded_links": embedded_links,
            "see_also_links": see_also_links
        }

    def search(self, query: str, results: int = 8) -> list:
        """
        Searches Wikipedia for a given query and returns a list of page titles.
        """
        import wikipedia as wiki_search
        try:
            return wiki_search.search(query, results=results)
        except Exception as e:
            logger.error(f"Wikipedia search error: {e}")
            return []

    def get_primary_domain(self, categories: list) -> str:
        """
        Heuristically determines the primary knowledge domain from Wikipedia categories.
        """
        domain_keywords = {
            "Mathematics": ["math", "algebra", "geometry", "calculus", "topology", "number theory"],
            "Physics": ["physics", "quantum", "relativity", "mechanics", "thermodynamics"],
            "Computer Science": ["computer", "algorithm", "software", "programming", "machine learning", "artificial intelligence"],
            "Biology": ["biology", "genetics", "evolution", "cell", "organism", "ecology"],
            "Chemistry": ["chemistry", "chemical", "molecule", "reaction", "element"],
            "History": ["history", "war", "empire", "ancient", "medieval", "revolution"],
            "Philosophy": ["philosophy", "ethics", "logic", "metaphysics", "epistemology"],
            "Economics": ["economics", "market", "finance", "trade", "monetary"],
            "Geography": ["geography", "country", "continent", "ocean", "river"],
        }

        lower_cats = " ".join(categories).lower()
        for domain, keywords in domain_keywords.items():
            if any(kw in lower_cats for kw in keywords):
                return domain

        return "General"


wikipedia_service = WikipediaService()

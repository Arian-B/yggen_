import logging
from typing import Optional
from app.services.providers.groq_provider import GroqProvider

logger = logging.getLogger(__name__)

# Relevance score below this threshold = drift
DRIFT_THRESHOLD = 35

class DriftDetector:
    """
    Uses Groq/Llama3 to score the contextual relevance of a Wikipedia
    hyperlink against the expedition's root topic and current context.

    Score 0–100:
    - 0–34:  Drift — off-topic definition or tangential link, block expansion.
    - 35–64: Loosely related — allow but flag as exploratory.
    - 65–100: Strongly related — full expansion allowed.
    """

    def __init__(self):
        self.groq = GroqProvider()

    async def score_relevance(
        self,
        expedition_root_topic: str,
        current_topic: str,
        candidate_link: str,
        context_topics: Optional[list] = None
    ) -> dict:
        """
        Returns a dict with:
        - score (int 0-100)
        - is_drift (bool)
        - reason (str) — short explanation for the UI warning
        """
        context_str = ""
        if context_topics:
            context_str = f"Topics already explored in this expedition: {', '.join(context_topics[:8])}."

        system_prompt = """You are an expert knowledge relevance evaluator.
Given an expedition root topic and a candidate Wikipedia hyperlink,
score how contextually relevant that link is to the expedition.

Rules:
- Score 0-100. Higher = more relevant.
- A score below 35 means the link is a bare definitional reference (e.g. a word definition used in passing) with no meaningful connection to the expedition topic.
- A score 35-64 means loosely related but exploratory.
- A score 65-100 means directly relevant.
- Keep reason to one sentence, plain language for a student audience.

Output JSON only:
{"score": 72, "reason": "Photosynthesis is directly related to the biology of plant cells."}"""

        user_prompt = f"""Expedition root topic: "{expedition_root_topic}"
Currently reading: "{current_topic}"
{context_str}
Candidate hyperlink: "{candidate_link}"

Score the relevance of "{candidate_link}" to the expedition about "{expedition_root_topic}"."""

        try:
            result = await self.groq.generate_json(
                model=None,
                system_prompt=system_prompt,
                user_prompt=user_prompt
            )
            score = int(result.get("score", 50))
            score = max(0, min(100, score))
            return {
                "score": score,
                "is_drift": score < DRIFT_THRESHOLD,
                "reason": result.get("reason", "Relevance could not be determined.")
            }
        except Exception as e:
            logger.error(f"DriftDetector error: {e}")
            # Fail open — allow traversal if detector errors
            return {"score": 60, "is_drift": False, "reason": "Relevance check unavailable."}


drift_detector = DriftDetector()

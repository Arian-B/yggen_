import logging
import urllib.parse
import httpx
from bs4 import BeautifulSoup
from typing import List

from langchain_core.tools import tool
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.services.model_router import model_router
from app.services.wikipedia_service import wikipedia_service

logger = logging.getLogger(__name__)

# --- LangChain Tools ---

@tool
def wikipedia_fetch(topic: str) -> str:
    """Fetches the raw text content of a Wikipedia page for a given topic."""
    logger.info(f"AGENT TOOL [wikipedia_fetch] called with: {topic}")
    page_data = wikipedia_service.get_page(topic)
    if not page_data:
        return f"Wikipedia page '{topic}' not found."
    return page_data.get("full_text", "")[:6000]

@tool
def web_search(query: str) -> str:
    """Searches the entire internet (via DuckDuckGo) and returns search result snippets with URLs."""
    logger.info(f"AGENT TOOL [web_search] called with: {query}")
    encoded_query = urllib.parse.quote(query)
    url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        resp = httpx.get(url, headers=headers, timeout=10.0)
        if resp.status_code != 200:
            return f"Web search failed with status code {resp.status_code}"
        
        soup = BeautifulSoup(resp.text, "lxml")
        results = []
        for a in soup.find_all("a", class_="result__snippet")[:4]:
            parent = a.find_parent("div", class_="result__body")
            title_el = parent.find("a", class_="result__a") if parent else None
            title = title_el.text.strip() if title_el else "No Title"
            snippet = a.text.strip()
            link = title_el["href"] if title_el and "href" in title_el.attrs else ""
            if link.startswith("//"):
                link = "https:" + link
            if "uddg=" in link:
                link = urllib.parse.unquote(link.split("uddg=")[1].split("&")[0])
            results.append(f"- **Title**: {title}\n  **Snippet**: {snippet}\n  **URL**: {link}")
        
        if not results:
            return "No search results found."
        return "\n\n".join(results)
    except Exception as e:
        return f"Error performing web search: {str(e)}"

@tool
def fetch_webpage(url: str) -> str:
    """Downloads and extracts the clean body text content of any webpage on the internet."""
    logger.info(f"AGENT TOOL [fetch_webpage] called with: {url}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        resp = httpx.get(url, headers=headers, timeout=12.0, follow_redirects=True)
        if resp.status_code != 200:
            return f"Failed to fetch webpage with status: {resp.status_code}"
        
        soup = BeautifulSoup(resp.text, "lxml")
        for el in soup(["script", "style", "header", "footer", "nav", "aside"]):
            el.decompose()
        
        text = soup.get_text(separator="\n")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        clean_text = "\n".join(lines)
        return clean_text[:4000]
    except Exception as e:
        return f"Error fetching webpage: {str(e)}"


# --- Content Agent Orchestration ---

class ContentAgent:
    def _get_agent_llm(self, provider_name: str, model_name: str):
        """
        Builds the LangChain chat model wrapper based on the active config.
        Supports Gemini, Groq, Ollama, and OpenRouter fallbacks.
        """
        logger.info(f"Instantiating Agent LLM for provider: {provider_name}, model: {model_name}")
        
        if provider_name == "gemini":
            return ChatGoogleGenerativeAI(
                model=model_name or settings.DEFAULT_SMART_MODEL,
                google_api_key=settings.GEMINI_API_KEY,
                temperature=0.3,
                convert_system_message_to_human=True,
                max_retries=0
            )
        elif provider_name == "groq":
            return ChatGroq(
                model_name=model_name or settings.DEFAULT_FAST_MODEL,
                groq_api_key=settings.GROQ_API_KEY,
                temperature=0.3,
                max_retries=0
            )
        elif provider_name == "ollama":
            # Ollama compatibility API over ChatOpenAI
            return ChatOpenAI(
                model=model_name or "llama3",
                openai_api_key="ollama",
                openai_api_base="http://localhost:11434/v1",
                temperature=0.3,
                max_retries=0
            )
        else:
            # Fallback (OpenRouter/GPT)
            return ChatOpenAI(
                model=model_name or settings.DEFAULT_FALLBACK_MODEL,
                openai_api_key=settings.OPENROUTER_API_KEY,
                openai_api_base="https://openrouter.ai/api/v1",
                temperature=0.3,
                max_retries=0
            )

    async def run_agent(self, topic: str) -> str:
        """
        Runs the LangChain agent loop using a clean tool-calling message loop.
        """
        provider_name, model_name = model_router.get_provider_config("longform")
        llm = self._get_agent_llm(provider_name, model_name)
        
        tools_list = [wikipedia_fetch, web_search, fetch_webpage]
        tools_map = {t.name: t for t in tools_list}
        
        llm_with_tools = llm.bind_tools(tools_list)
        
        system_prompt = f"""You are a world-class educational research agent.
Your goal is to build a structured, high-quality, polymath-level Markdown article for the topic: "{topic}".

You MUST gather information first by calling tools:
- Call `wikipedia_fetch` to get the base article content.
- Call `web_search` to find other articles, facts, and insights across the internet.
- Call `fetch_webpage` if you need to read details from a specific search result URL.

After gathering all the information, write the final article.
The article MUST:
1. Maintain Wikipedia's key sections and subsections (excluding References, See Also, External Links).
2. Write a detailed, highly educational, and comprehensive summary of each section.
3. Append a final major section:
   ## Beyond Wikipedia: Deep Dive & Insights
   In this section, provide:
   - Extra context from the web that the Wikipedia page lacks.
   - 3-5 interesting and mind-blowing fun facts about the topic.
   - Most important general knowledge and takeaways.
4. Output raw markdown. Do not wrap the final response in code blocks.
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Please research and write the polymath article on: {topic}")
        ]
        
        for turn in range(6):
            logger.info(f"Agent turn {turn+1} calling LLM...")
            try:
                response = await llm_with_tools.ainvoke(messages)
            except Exception as e:
                logger.error(f"LLM invoke failed: {str(e)}")
                break
                
            messages.append(response)
            
            # Check for tool calls
            if hasattr(response, "tool_calls") and response.tool_calls:
                for tool_call in response.tool_calls:
                    name = tool_call["name"]
                    args = tool_call["args"]
                    call_id = tool_call["id"]
                    
                    logger.info(f"Agent executing tool '{name}' with args {args}")
                    if name in tools_map:
                        try:
                            # Invoke tool synchronously since they are simple HTTP requests
                            tool_result = tools_map[name].invoke(args)
                        except Exception as te:
                            tool_result = f"Tool execution error: {te}"
                    else:
                        tool_result = f"Tool '{name}' is not supported."
                    
                    messages.append(ToolMessage(content=str(tool_result), name=name, tool_call_id=call_id))
            else:
                # No tool calls, returning final answer
                logger.info("Agent concluded research loop.")
                return response.content
                
    async def stream_article(self, topic: str):
        """
        Two-phase streaming generator — yields SSE event dicts.

        Phase 1 (Research): deterministically fetches Wikipedia + runs a web search.
                            Yields status events so the UI can show progress.
        Phase 2 (Generate): calls llm.astream() to emit article tokens one-by-one,
                            exactly like Gemini / ChatGPT streaming.

        Yields dicts:
            {'type': 'status', 'text': 'Fetching Wikipedia...'}
            {'type': 'chunk',  'text': '# Photosynthesis\n\nPhoto...'}
            (caller sends 'done' after consuming all chunks)
        """
        from app.services.wikipedia_service import wikipedia_service

        provider_name, model_name = model_router.get_provider_config("longform")
        llm = self._get_agent_llm(provider_name, model_name)

        research_parts: list[str] = []

        # ── Phase 1a: Wikipedia ────────────────────────────────────────────────
        yield {"type": "status", "text": "Fetching Wikipedia..."}
        try:
            page_data = wikipedia_service.get_page(topic)
            if page_data:
                wiki_text = page_data.get("full_text", "")
                if wiki_text:
                    research_parts.append(f"WIKIPEDIA ARTICLE:\n{wiki_text[:5000]}")
        except Exception as e:
            logger.warning(f"stream_article: Wikipedia fetch failed: {e}")

        # ── Phase 1b: Web Search ───────────────────────────────────────────────
        yield {"type": "status", "text": "Searching the web..."}
        try:
            search_result = web_search.invoke({"query": f"{topic} comprehensive educational overview"})
            if search_result and "No search results" not in search_result:
                research_parts.append(f"WEB SEARCH RESULTS:\n{search_result}")
        except Exception as e:
            logger.warning(f"stream_article: Web search failed: {e}")

        # ── Phase 2: Stream final article generation ───────────────────────────
        yield {"type": "status", "text": "Writing article..."}

        research_context = "\n\n---\n\n".join(research_parts) if research_parts else ""

        system_prompt = f"""You are a world-class educational research agent writing a polymath-level Markdown article on the topic: "{topic}".
You have been given research materials below. Use them to write a comprehensive, beautifully structured article.

RULES:
1. Start with a # {topic} title heading.
2. Mirror Wikipedia's section structure (## subheadings) but EXCLUDE References, See Also, External Links sections.
3. Write detailed, highly educational content for every section — go deep.
4. Append a final major section at the end:
   ## Beyond Wikipedia: Deep Dive & Insights
   - Extra context and facts the Wikipedia article lacks.
   - 3–5 mind-blowing fun facts about the topic.
   - Key takeaways and most important things to know.
5. Output raw Markdown only. Do NOT wrap in code blocks or add any preamble."""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Research materials:\n\n{research_context[:8000]}\n\nWrite the polymath article on \"{topic}\" now."),
        ]

        try:
            async for chunk in llm.astream(messages):
                text = getattr(chunk, "content", "") or ""
                if text:
                    yield {"type": "chunk", "text": text}
        except Exception as e:
            logger.error(f"stream_article: LLM streaming failed: {e}")
            # Graceful degradation: yield the raw Wikipedia text as plain content
            if research_parts:
                fallback = f"# {topic}\n\n" + "\n\n".join(research_parts)[:4000]
                yield {"type": "chunk", "text": fallback}
            else:
                yield {"type": "chunk", "text": f"# {topic}\n\nContent could not be generated at this time. Please try again later."}

content_agent = ContentAgent()

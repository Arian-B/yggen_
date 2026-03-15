from fastapi import APIRouter, HTTPException, Depends, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from app.models.expedition_models import ExpeditionCreate, Expedition
from app.models.node_models import Node
from app.services.expedition_service import expedition_service
from app.services.content_generator import content_generator
from app.services.traversal_engine import traversal_engine
from app.services.reflection_engine import reflection_engine
from app.services.xp_engine import xp_engine
from app.database.connection import db

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)

def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> Optional[str]:
    """Returns user_id from JWT if present, else None (fail-open for now)."""
    if not credentials:
        return None
    try:
        from app.services.auth_service import auth_service
        payload = auth_service.decode_token(credentials.credentials)
        return payload.get("sub") if payload else None
    except Exception:
        return None

@router.get("/{expedition_id}/graph", response_model=dict)
async def get_expedition_graph(expedition_id: str):
    """
    Returns all nodes and edges for a given expedition.
    Used by MapMode (Galaxy View) to render the full knowledge graph.
    """
    try:
        # Fetch expedition meta
        exp_doc = db.db.collection('expeditions').get(expedition_id)
        if not exp_doc:
            raise HTTPException(status_code=404, detail="Expedition not found")

        # Fetch all nodes for this expedition
        aql = """
            FOR n IN nodes
                FILTER n.expedition_id == @exp_id
                RETURN n
        """
        cursor = db.db.aql.execute(aql, bind_vars={"exp_id": expedition_id})
        nodes = list(cursor)

        # Fetch all edges for this expedition (join via nodes)
        node_ids = [f"nodes/{n['_key']}" for n in nodes]
        edge_aql = """
            FOR e IN edges
                FILTER e._from IN @node_ids OR e._to IN @node_ids
                RETURN e
        """
        edge_cursor = db.db.aql.execute(edge_aql, bind_vars={"node_ids": node_ids})
        raw_edges = list(edge_cursor)

        # Format response
        formatted_nodes = [{
            "node_id": n["_key"],
            "topic": n.get("topic", ""),
            "level": n.get("level", 0),
            "link_type": n.get("link_type"),
            "node_type": n.get("node_type", "standard"),
            "wikipedia_url": n.get("wikipedia_url")
        } for n in nodes]

        formatted_edges = [{
            "from_node_id": e["_from"].replace("nodes/", ""),
            "to_node_id": e["_to"].replace("nodes/", ""),
            "type": e.get("type", "embedded_link")
        } for e in raw_edges]

        return {
            "expedition_id": expedition_id,
            "root_topic": exp_doc.get("root_topic", ""),
            "nodes": formatted_nodes,
            "edges": formatted_edges
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/node/{node_id}/check-drift", response_model=dict)
async def check_drift(node_id: str, payload: dict = Body(...)):
    """
    Checks whether navigating to a candidate Wikipedia link would be a drift
    from the current expedition context.
    Payload: { "candidate_topic": "...", "expedition_id": "..." }
    """
    from app.services.drift_detector import drift_detector

    candidate_topic = payload.get("candidate_topic", "")
    expedition_id = payload.get("expedition_id", "")

    if not candidate_topic or not expedition_id:
        raise HTTPException(status_code=400, detail="Missing candidate_topic or expedition_id")

    try:
        # Fetch node topic and expedition root
        node_doc = db.db.collection('nodes').get(node_id)
        if not node_doc:
            raise HTTPException(status_code=404, detail="Node not found")

        exp_doc = db.db.collection('expeditions').get(expedition_id)
        if not exp_doc:
            raise HTTPException(status_code=404, detail="Expedition not found")

        # Fetch recently visited topics for context
        aql = "FOR n IN nodes FILTER n.expedition_id == @id SORT n.created_at DESC LIMIT 6 RETURN n.topic"
        cursor = db.db.aql.execute(aql, bind_vars={"id": expedition_id})
        context_topics = list(cursor)

        result = await drift_detector.score_relevance(
            expedition_root_topic=exp_doc.get("root_topic", ""),
            current_topic=node_doc.get("topic", ""),
            candidate_link=candidate_topic,
            context_topics=context_topics
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{expedition_id}/fork", response_model=dict)
async def fork_expedition(expedition_id: str, payload: dict = Body(...)):
    """
    Forks from a drift node into a brand new, independent expedition.
    Like opening a new project from a bookmarked page.
    Payload: { "user_id": "...", "root_topic": "..." }
    """
    user_id = payload.get("user_id")
    root_topic = payload.get("root_topic")

    if not user_id or not root_topic:
        raise HTTPException(status_code=400, detail="Missing user_id or root_topic")

    try:
        result = expedition_service.create_expedition(
            user_id=user_id,
            root_topic=root_topic
        )
        return {"forked_from": expedition_id, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/node/{node_id}/summary", response_model=dict)
async def get_node_summary(node_id: str):
    """
    Generates an AI summary and key points for a Wikipedia article node.
    Uses AIEngine (Groq for speed). Results are NOT cached — called on demand.
    """
    from app.services.ai_engine import ai_engine

    try:
        node_doc = db.db.collection('nodes').get(node_id)
        if not node_doc:
            raise HTTPException(status_code=404, detail="Node not found")

        topic = node_doc.get("topic", "Unknown")
        # Use the cached Wikipedia summary text if available, else short stub
        wiki_text = node_doc.get("summary") or node_doc.get("content", "")[:800]

        provider_name, model_name = "groq", None  # Groq for speed
        from app.services.providers.groq_provider import GroqProvider
        groq_provider = GroqProvider()

        system_prompt = """You are an expert educator distilling Wikipedia articles for curious students.
Given article text, produce a JSON response with:
- "summary": 2-3 sentence plain-language overview (max 60 words)
- "key_points": list of 3-5 bullet points (1 sentence each, no jargon)

Output JSON only, no extra text."""

        user_prompt = f"Article: {topic}\n\nText: {wiki_text}\n\nSummarize for a curious student."

        result = await groq_provider.generate_json(
            model=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt
        )

        return {
            "node_id": node_id,
            "topic": topic,
            "summary": result.get("summary", ""),
            "key_points": result.get("key_points", [])
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=dict)
async def search_wikipedia(q: str = ""):
    """
    Live Wikipedia search — returns matching article titles and summaries.
    Powers the search dropdown on the LandingPage.
    """
    if not q or len(q.strip()) < 2:
        return {"results": []}
    try:
        from app.services.wikipedia_service import wikipedia_service
        import httpx
        # Use Wikipedia's opensearch API for fast, real-time suggestions
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://en.wikipedia.org/w/api.php",
                headers={
                    "User-Agent": "wikiyggen_/1.0 (https://github.com/Arian-B/yggen_; contact@wikiyggen.dev) httpx/0.27",
                    "Accept": "application/json"
                },
                params={
                    "action": "opensearch",
                    "search": q.strip(),
                    "limit": 8,
                    "namespace": 0,
                    "format": "json",
                    "redirects": "resolve"
                }
            )
            data = resp.json()
        # opensearch returns [query, [titles], [descriptions], [urls]]
        titles       = data[1] if len(data) > 1 else []
        descriptions = data[2] if len(data) > 2 else []
        urls         = data[3] if len(data) > 3 else []
        results = [
            {
                "title":       titles[i],
                "description": descriptions[i] if i < len(descriptions) else "",
                "url":         urls[i]         if i < len(urls)         else ""
            }
            for i in range(len(titles))
        ]
        return {"results": results, "query": q}
    except Exception as e:
        return {"results": [], "error": str(e)}


@router.post("/create", response_model=dict)
async def create_expedition(
    expedition_data: ExpeditionCreate,
    auth_user_id: Optional[str] = Depends(get_optional_user)
):
    """
    Initiates a new expedition by searching and mapping a Wikipedia article.
    If a valid JWT is provided, the JWT user_id overrides the body payload.
    """
    if not auth_user_id and not expedition_data.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = auth_user_id or expedition_data.user_id
    try:
        result = expedition_service.create_expedition(
            user_id=user_id,
            root_topic=expedition_data.root_topic
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}", response_model=dict)
async def get_user_stats(user_id: str):
    """Fetches user stats (XP, Level)."""
    try:
        user_doc = db.db.collection('users').get(user_id)
        if not user_doc:
            return {"user_id": user_id, "total_xp": 0, "level": 0}
        return {
            "user_id": user_doc.get('_key'),
            "total_xp": user_doc.get('total_xp', 0),
            "level": user_doc.get('level', 0)
        }
    except Exception:
        return {"user_id": user_id, "total_xp": 0, "level": 0}

@router.get("/user/{user_id}/expeditions", response_model=dict)
async def get_user_expeditions(user_id: str):
    """
    Returns all expeditions for a user, grouped by domain.
    Powers the Knowledge Library (Letterboxd-style) page.
    """
    try:
        aql = """
            FOR e IN expeditions
                FILTER e.user_id == @user_id
                SORT e.created_at DESC
                RETURN e
        """
        cursor = db.db.aql.execute(aql, bind_vars={"user_id": user_id})
        expeditions = list(cursor)

        # Group by domain
        grouped: dict = {}
        total_xp = 0
        total_nodes = 0

        for exp in expeditions:
            # Use real Wikipedia category; fall back to domain for old records
            category = exp.get("category") or exp.get("domain", "General")
            total_xp += exp.get("global_xp_earned", 0)
            total_nodes += exp.get("nodes_visited", 0)

            card = {
                "expedition_id": exp.get("_key"),
                "root_topic": exp.get("root_topic", ""),
                "domain": category,
                "category": category,
                "nodes_visited": exp.get("nodes_visited", 0),
                "xp_earned": exp.get("global_xp_earned", 0),
                "state": exp.get("state", "active"),
                "created_at": str(exp.get("created_at", "")),
                "root_node_id": None  # filled below
            }

            # Look up root node (level 0) for this expedition
            try:
                root_cursor = db.db.aql.execute(
                    "FOR n IN nodes FILTER n.expedition_id == @eid AND n.level == 0 LIMIT 1 RETURN n._key",
                    bind_vars={"eid": exp.get("_key")}
                )
                root_key = next(root_cursor, None)
                card["root_node_id"] = root_key
            except Exception:
                pass

            grouped.setdefault(category, []).append(card)

        return {
            "user_id": user_id,
            "total_expeditions": len(expeditions),
            "total_nodes_visited": total_nodes,
            "total_xp": total_xp,
            "grouped_by_domain": grouped,
            "categories": sorted(grouped.keys())   # ordered list of distinct categories
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/node/{node_id}", response_model=dict)
async def get_node_content(node_id: str):
    """
    Fetches node data. Lazy-loads full Wikipedia article text if not cached.
    Also returns an AI-generated summary via the AIEngine.
    """
    from app.services.wikipedia_service import wikipedia_service
    from app.services.ai_engine import ai_engine

    try:
        node_doc = db.db.collection('nodes').get(node_id)
        if not node_doc:
            raise HTTPException(status_code=404, detail="Node not found")
        
        node = Node(**node_doc)

        # Lazy-load Wikipedia full article text if not already cached
        if not node.content and node.topic:
            page_data = wikipedia_service.get_page(node.topic)
            if page_data:
                node.content = page_data.get("full_text", "")
                node.sources = [page_data.get("url", "")]
                if not node.wikipedia_url:
                    node.wikipedia_url = page_data.get("url")
                if not node.summary:
                    node.summary = page_data.get("summary", "")[:500]

                # Update DB with fetched content
                update_data = {
                    "content": node.content,
                    "sources": node.sources,
                    "wikipedia_url": node.wikipedia_url,
                    "summary": node.summary
                }
                db.db.collection('nodes').update({**node_doc, **update_data})

        return node.dict()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/node/{node_id}/continue", response_model=dict)
async def continue_expedition(
    node_id: str,
    payload: dict,
    auth_user_id: Optional[str] = Depends(get_optional_user)
):
    """
    Determines next node logic and awards XP.
    Payload: {"expedition_id": "...", "user_id": "..."}
    JWT user_id takes precedence over payload user_id.
    """
    expedition_id = payload.get("expedition_id")
    user_id = auth_user_id or payload.get("user_id")

    if not expedition_id or not user_id:
        raise HTTPException(status_code=400, detail="Missing expedition_id or user_id")

    # 1. Award XP for finishing current node
    try:
        node_doc = db.db.collection('nodes').get(node_id)
        if node_doc:
            xp_amount = xp_engine.calculate_node_xp(node_doc.get('difficulty_score', 10))
            xp_engine.update_user_xp(user_id, xp_amount)
            
            # Check for reflection
            should_reflect = reflection_engine.should_trigger_reflection(
                node_level=node_doc.get('level', 0),
                abstraction_score=node_doc.get('abstraction_score', 0)
            )
            
            if should_reflect:
                return {
                    "reflection_required": True,
                    "message": "Reflection required to proceed.",
                    "xp_gained": xp_amount,
                    "node_id": node_id # Stay on this node for reflection
                }
    except Exception as e:
        print(f"Error processing XP/Reflection: {e}")

    # 2. Get Next Node
    next_node_id = traversal_engine.select_next_node(expedition_id, node_id)
    
    return {
        "next_node_id": next_node_id,
        "reflection_required": False,
        "message": "Continuing expedition..." if next_node_id else "Path complete.",
        "xp_gained": xp_amount if 'xp_amount' in locals() else 0
    }

@router.post("/node/{node_id}/reflect", response_model=dict)
async def submit_reflection(node_id: str, payload: dict = Body(...)):
    """
    Evaluates user reflection.
    Payload: {"user_id": "...", "answer": "..."}
    """
    user_id = payload.get("user_id")
    answer = payload.get("answer")
    
    if not user_id or not answer:
        raise HTTPException(status_code=400, detail="Missing user_id or answer")

    try:
        node_doc = db.db.collection('nodes').get(node_id)
        if not node_doc:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Evaluate
        eval_result = await reflection_engine.evaluate_reflection_answer(
            node_topic=node_doc.get('topic', 'Unknown'),
            user_answer=answer
        )
        
        score = eval_result.get('score', 0)
        feedback = eval_result.get('feedback', '')
        passed = score >= 60
        
        result = {
            "passed": passed,
            "score": score,
            "feedback": feedback
        }
        
        if passed:
            bonus = xp_engine.apply_reflection_bonus()
            xp_engine.update_user_xp(user_id, bonus)
            result["xp_bonus"] = bonus
            
            # Get next node logic to allow progression
            # We need expedition_id. For now, try to find it via Node or pass in payload?
            # Model Node has expedition_id.
            expedition_id = node_doc.get('expedition_id')
            if expedition_id:
                 next_node = traversal_engine.select_next_node(expedition_id, node_id)
                 result["next_node_id"] = next_node
            
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

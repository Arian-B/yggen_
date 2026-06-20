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
            "wikipedia_url": n.get("wikipedia_url"),
            "completed": n.get("completed", False)
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
        result = await expedition_service.create_expedition(
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
        result = await expedition_service.create_expedition(
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

@router.patch("/{expedition_id}/archive")
async def archive_expedition(
    expedition_id: str,
    auth_user_id: Optional[str] = Depends(get_optional_user)
):
    """
    Sets the state of an expedition to 'archived'.
    """
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    success = expedition_service.archive_expedition(expedition_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to archive expedition")
    return {"status": "success"}

@router.delete("/{expedition_id}")
async def delete_expedition(
    expedition_id: str,
    auth_user_id: Optional[str] = Depends(get_optional_user)
):
    """
    Deletes an expedition entirely from the database.
    """
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    try:
        db.db.collection('expeditions').delete(expedition_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
                
            # Look up last visited node
            traversal = exp.get("traversal_path", [])
            card["last_node_id"] = traversal[-1] if traversal else card["root_node_id"]

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

@router.get("/node/{node_id}/stream")
async def stream_node_content(node_id: str):
    """
    SSE streaming endpoint — delivers article content progressively.

    Event sequence:
      1. 'metadata' — topic, domain, previous_node_id, next_options — emitted INSTANTLY
      2. 'status'   — progress messages ("Fetching Wikipedia...", "Writing article...")
      3. 'chunk'    — LLM token chunks as they arrive (or cached content chunks)
      4. 'done'     — signals stream end; content has been saved to DB
      5. 'error'    — if something goes wrong

    Cached nodes (content_version == "2.0") skip AI generation entirely and
    emit the stored content in fast chunks, appearing instant to the user.
    """
    import json
    from fastapi.responses import StreamingResponse
    from app.services.wikipedia_service import wikipedia_service
    from app.services.content_agent import content_agent
    from app.services.etl_pipeline import etl_pipeline

    async def event_gen():
        try:
            node_doc = db.db.collection('nodes').get(node_id)
            if not node_doc:
                yield f"data: {json.dumps({'type': 'error', 'text': 'Node not found'})}\n\n"
                return

            topic = node_doc.get("topic", "")
            expedition_id = node_doc.get("expedition_id")

            # Build traversal back-link
            previous_node_id = None
            if expedition_id:
                try:
                    exp_doc = db.db.collection('expeditions').get(expedition_id)
                    if exp_doc:
                        path = exp_doc.get("traversal_path", [])
                        if node_id in path:
                            idx = path.index(node_id)
                            if idx > 0:
                                previous_node_id = path[idx - 1]
                except Exception:
                    pass

            # Gather next options (best-effort, non-blocking)
            next_options: list = []
            try:
                links_data = wikipedia_service.get_page_links(topic)
                raw = links_data.get("see_also_links", []) + links_data.get("embedded_links", [])
                seen: set = set()
                next_options = [x for x in raw if not (x.lower() in seen or seen.add(x.lower()))]
                next_options = next_options[:15]
            except Exception:
                pass

            # ── Event 1: Metadata — page renders immediately ───────────────────
            yield f"data: {json.dumps({'type': 'metadata', 'node_id': node_doc.get('_key'), 'expedition_id': expedition_id, 'topic': topic, 'level': node_doc.get('level', 0), 'primary_domain': node_doc.get('primary_domain', 'General'), 'secondary_domains': node_doc.get('secondary_domains', []), 'wikipedia_url': node_doc.get('wikipedia_url'), 'summary': node_doc.get('summary'), 'sources': node_doc.get('sources', []), 'link_type': node_doc.get('link_type'), 'completed': node_doc.get('completed', False), 'previous_node_id': previous_node_id, 'next_options': next_options})}\n\n"

            # ── Event 2+: Content ──────────────────────────────────────────────
            if node_doc.get("content") and node_doc.get("content_version") == "2.0":
                # CACHED: stream stored content in chunks — appears instant
                stored = node_doc["content"]
                chunk_size = 300
                for i in range(0, len(stored), chunk_size):
                    yield f"data: {json.dumps({'type': 'chunk', 'text': stored[i:i + chunk_size]})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

            # NOT CACHED: stream AI generation live
            full_content = ""
            async for event in content_agent.stream_article(topic):
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") == "chunk":
                    full_content += event.get("text", "")

            # Persist to DB after streaming completes
            if full_content:
                try:
                    await etl_pipeline.save_content(
                        node_id=node_id,
                        content=full_content,
                        wiki_summary=node_doc.get("summary", ""),
                        wikipedia_url=node_doc.get("wikipedia_url"),
                    )
                except Exception as save_err:
                    logger.error(f"stream_node_content: DB save failed: {save_err}")

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"stream_node_content: unhandled error for node {node_id}: {e}")
            yield f"data: {json.dumps({'type': 'error', 'text': str(e)})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/node/{node_id}", response_model=dict)
async def get_node_content(node_id: str):
    """
    Fetches node data, running the ETL Ingestion Pipeline if not cached in version 2.0 format.
    Also returns traversal history checkpoints and next page options.
    """
    from app.services.wikipedia_service import wikipedia_service
    from app.services.etl_pipeline import etl_pipeline

    try:
        node_doc = db.db.collection('nodes').get(node_id)
        if not node_doc:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Run ETL Ingestion pipeline if content is missing or in old version
        if not node_doc.get("content") or node_doc.get("content_version") != "2.0":
            topic = node_doc.get("topic")
            try:
                node_doc = await etl_pipeline.run_pipeline(node_id, topic)
            except Exception as e:
                print(f"ETL pipeline run failed: {e}")

        # Fetch previous checkpoint from expedition traversal path
        previous_node_id = None
        expedition_id = node_doc.get("expedition_id")
        if expedition_id:
            exp_doc = db.db.collection('expeditions').get(expedition_id)
            if exp_doc:
                traversal_path = exp_doc.get("traversal_path", [])
                if node_id in traversal_path:
                    idx = traversal_path.index(node_id)
                    if idx > 0:
                        previous_node_id = traversal_path[idx - 1]

        # Fetch next options (related links) dynamically
        next_options = []
        topic = node_doc.get("topic")
        if topic:
            try:
                links_data = wikipedia_service.get_page_links(topic)
                next_options = links_data.get("see_also_links", []) + links_data.get("embedded_links", [])
                # Deduplicate and clean
                seen = set()
                next_options = [x for x in next_options if not (x.lower() in seen or seen.add(x.lower()))]
                next_options = next_options[:15]
            except Exception as e:
                print(f"Error fetching page links: {e}")

        res = {
            "node_id": node_doc.get("_key"),
            "expedition_id": node_doc.get("expedition_id"),
            "topic": node_doc.get("topic"),
            "level": node_doc.get("level", 0),
            "primary_domain": node_doc.get("primary_domain", "General"),
            "secondary_domains": node_doc.get("secondary_domains", []),
            "wikipedia_url": node_doc.get("wikipedia_url"),
            "summary": node_doc.get("summary"),
            "content": node_doc.get("content"),
            "sources": node_doc.get("sources", []),
            "link_type": node_doc.get("link_type"),
            "completed": node_doc.get("completed", False),
            "previous_node_id": previous_node_id,
            "next_options": next_options
        }
        return res

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/node/{node_id}/select-next", response_model=dict)
async def select_next_node(node_id: str, payload: dict = Body(...)):
    """
    Selects the next node in the traversal path.
    If the node doesn't exist yet, it is created and runs through the ETL Pipeline dynamically.
    Updates the traversal_path history stack.
    """
    from datetime import datetime
    from app.services.etl_pipeline import etl_pipeline
    from app.services.wikipedia_service import wikipedia_service
    import uuid

    next_topic = payload.get("next_topic")
    expedition_id = payload.get("expedition_id")
    next_node_id = payload.get("next_node_id")

    if not expedition_id:
        raise HTTPException(status_code=400, detail="Missing expedition_id")
    if not next_topic and not next_node_id:
        raise HTTPException(status_code=400, detail="Missing next_topic or next_node_id")

    try:
        # Get expedition
        exp_doc = db.db.collection('expeditions').get(expedition_id)
        if not exp_doc:
            raise HTTPException(status_code=404, detail="Expedition not found")

        # Find or create node
        if not next_node_id:
            # Query if a node with this topic already exists in the expedition
            cursor = db.db.aql.execute(
                "FOR n IN nodes FILTER n.expedition_id == @exp_id AND LOWER(n.topic) == LOWER(@topic) LIMIT 1 RETURN n",
                bind_vars={"exp_id": expedition_id, "topic": next_topic.strip()}
            )
            existing_node = next(cursor, None)
            if existing_node:
                next_node_id = existing_node["_key"]
            else:
                # Get current node for context
                curr_doc = db.db.collection('nodes').get(node_id)
                level = 1
                primary_domain = "General"
                if curr_doc:
                    level = curr_doc.get("level", 0) + 1
                    primary_domain = curr_doc.get("primary_domain", "General")

                # Resolve title/domain from wikipedia
                page_data = wikipedia_service.get_page(next_topic)
                wikipedia_url = None
                summary = ""
                if page_data:
                    next_topic = page_data.get("title", next_topic)
                    wikipedia_url = page_data.get("url")
                    summary = page_data.get("summary", "")[:500]
                    primary_domain = wikipedia_service.get_clean_category(page_data.get("categories", []))

                # Create the skeleton node
                from app.models.node_models import Node
                new_node = Node(
                    expedition_id=expedition_id,
                    topic=next_topic,
                    level=level,
                    primary_domain=primary_domain,
                    difficulty_score=50,
                    abstraction_score=50,
                    wikipedia_url=wikipedia_url,
                    summary=summary,
                    link_type="drift" if "drift" in next_topic.lower() else "embedded_link",
                    parent_node_id=node_id
                )
                
                # Save skeleton node
                doc = expedition_service._serialize_doc(new_node.dict())
                doc['_key'] = new_node.node_id
                db.db.collection('nodes').insert(doc)
                next_node_id = new_node.node_id

                # Create connecting edge
                expedition_service.create_edge(node_id, next_node_id, "embedded_link")

                # Run ETL Pipeline
                try:
                    await etl_pipeline.run_pipeline(next_node_id, next_topic)
                except Exception as ee:
                    print(f"ETL pipeline execution failed for select-next: {ee}")

        # Update traversal path in the expedition doc
        traversal_path = exp_doc.get("traversal_path", [])
        if node_id in traversal_path:
            idx = traversal_path.index(node_id)
            # Truncate forward history if branching from a past node
            traversal_path = traversal_path[:idx + 1]
        else:
            traversal_path.append(node_id)

        if next_node_id not in traversal_path:
            traversal_path.append(next_node_id)

        db.db.collection('expeditions').update({
            '_key': expedition_id,
            'traversal_path': traversal_path,
            'last_activity': datetime.utcnow().isoformat()
        })

        return {"next_node_id": next_node_id}
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

    xp_amount = 0
    already_completed = False
    should_reflect = False

    # 1. Award XP for finishing current node
    try:
        node_doc = db.db.collection('nodes').get(node_id)
        if node_doc:
            already_completed = node_doc.get('completed', False)
            if not already_completed:
                # Mark node as completed in DB
                db.db.collection('nodes').update({'_key': node_id, 'completed': True})
                
                # Calculate and update user XP
                xp_amount = xp_engine.calculate_node_xp(node_doc.get('difficulty_score', 10))
                xp_engine.update_user_xp(user_id, xp_amount)
                
                # Update expedition's nodes_visited and global_xp_earned
                aql_update_exp = """
                LET exp = DOCUMENT(CONCAT('expeditions/', @exp_id))
                UPDATE exp WITH {
                    nodes_visited: exp.nodes_visited + 1,
                    global_xp_earned: exp.global_xp_earned + @xp_amount
                } IN expeditions
                """
                db.db.aql.execute(aql_update_exp, bind_vars={'exp_id': expedition_id, 'xp_amount': xp_amount})
                
                # Check if all nodes for this expedition are now completed
                all_nodes_cursor = db.db.aql.execute(
                    "FOR n IN nodes FILTER n.expedition_id == @exp_id RETURN n",
                    bind_vars={"exp_id": expedition_id}
                )
                all_nodes = list(all_nodes_cursor)
                if all_nodes and all(n.get('completed', False) for n in all_nodes):
                    db.db.collection('expeditions').update({'_key': expedition_id, 'state': 'completed'})

            # Check for reflection (only if not already completed/backtracked)
            if not already_completed:
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
        "xp_gained": xp_amount
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
            expedition_id = node_doc.get('expedition_id')
            if expedition_id:
                 next_node = traversal_engine.select_next_node(expedition_id, node_id)
                 result["next_node_id"] = next_node
                 
                 # Update expedition with bonus XP
                 aql_update_exp = """
                 LET exp = DOCUMENT(CONCAT('expeditions/', @exp_id))
                 UPDATE exp WITH {
                     global_xp_earned: exp.global_xp_earned + @bonus
                 } IN expeditions
                 """
                 try:
                     db.db.aql.execute(aql_update_exp, bind_vars={'exp_id': expedition_id, 'bonus': bonus})
                 except Exception as e:
                     print(f"Error updating expedition with reflection bonus: {e}")
            
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}/expertise", response_model=dict)
async def get_user_expertise(user_id: str):
    """
    Retrieves user expertise domain breakdown, breadth, and depth.
    """
    try:
        from app.services.expertise_service import expertise_service
        return expertise_service.calculate_user_expertise(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{expedition_id}", response_model=dict)
async def delete_expedition(
    expedition_id: str,
    auth_user_id: Optional[str] = Depends(get_optional_user)
):
    """
    Deletes an expedition and all its associated nodes and edges from ArangoDB.
    """
    try:
        # Check if expedition exists
        exp_doc = db.db.collection('expeditions').get(expedition_id)
        if not exp_doc:
            raise HTTPException(status_code=404, detail="Expedition not found")

        # Find all nodes for this expedition
        nodes_cursor = db.db.aql.execute(
            "FOR n IN nodes FILTER n.expedition_id == @id RETURN n._key",
            bind_vars={"id": expedition_id}
        )
        node_keys = list(nodes_cursor)
        node_ids = [f"nodes/{key}" for key in node_keys]

        # Delete associated edges
        if node_ids:
            db.db.aql.execute(
                "FOR e IN edges FILTER e._from IN @node_ids OR e._to IN @node_ids REMOVE e IN edges",
                bind_vars={"node_ids": node_ids}
            )

        # Delete associated nodes
        db.db.aql.execute(
            "FOR n IN nodes FILTER n.expedition_id == @id REMOVE n IN nodes",
            bind_vars={"id": expedition_id}
        )

        # Delete expedition itself
        db.db.collection('expeditions').delete(expedition_id)

        return {"message": "Expedition deleted", "expedition_id": expedition_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


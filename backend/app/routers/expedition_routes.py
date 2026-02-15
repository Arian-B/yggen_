from fastapi import APIRouter, HTTPException, Depends, Body
from app.models.expedition_models import ExpeditionCreate, Expedition
from app.models.node_models import Node
from app.services.expedition_service import expedition_service
from app.services.content_generator import content_generator
from app.services.traversal_engine import traversal_engine
from app.services.reflection_engine import reflection_engine
from app.services.xp_engine import xp_engine
from app.database.connection import db

router = APIRouter()

@router.post("/create", response_model=dict)
async def create_expedition(expedition_data: ExpeditionCreate):
    """
    Initiates a new expedition.
    Creates the expedition record and the root node (Level 0).
    """
    try:
        result = await expedition_service.create_expedition(
            user_id=expedition_data.user_id,
            root_topic=expedition_data.root_topic
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}", response_model=dict)
async def get_user_stats(user_id: str):
    """
    Fetches user stats (XP, Level).
    """
    try:
        # Fetch user doc. If not found, return defaults.
        user_doc = db.db.collection('users').get(user_id)
        if not user_doc:
            return {"user_id": user_id, "total_xp": 0, "level": 0}
        
        return {
            "user_id": user_doc.get('_key'),
            "total_xp": user_doc.get('total_xp', 0),
            "level": user_doc.get('level', 0)
        }
    except Exception as e:
        # Return default if error, or bubble up
        # For robustness, return safe default
        return {"user_id": user_id, "total_xp": 0, "level": 0}

@router.get("/node/{node_id}", response_model=dict)
async def get_node_content(node_id: str):
    """
    Fetches node data.
    Lazy-loads AI content if missing.
    """
    try:
        node_doc = db.db.collection('nodes').get(node_id)
        if not node_doc:
            raise HTTPException(status_code=404, detail="Node not found")
        
        node = Node(**node_doc)
        
        if not node.content:
            try:
                content_data = await content_generator.generate_node_content(
                    topic=node.topic,
                    difficulty_score=node.difficulty_score,
                    abstraction_score=node.abstraction_score
                )
                
                node.content = content_data['content']
                node.sources = content_data['sources']
                
                node_doc['content'] = node.content
                node_doc['sources'] = node.sources
                db.db.collection('nodes').update(node_doc)
                
            except Exception as e:
                raise HTTPException(status_code=503, detail=f"Content generation failed: {str(e)}")

        return node.dict()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/node/{node_id}/continue", response_model=dict)
async def continue_expedition(node_id: str, payload: dict):
    """
    Determines next node logic and awards XP.
    Payload: {"expedition_id": "...", "current_node_id": "...", "user_id": "..."}
    """
    expedition_id = payload.get("expedition_id")
    user_id = payload.get("user_id") # Add current_node_id if distinct from path param
    
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

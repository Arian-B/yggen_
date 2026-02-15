from typing import Optional
from app.database.connection import db
from app.models.node_models import Node

class TraversalEngine:
    def __init__(self):
        self.db = db

    def select_next_node(self, expedition_id: str, current_node_id: str) -> Optional[str]:
        """
        Determines the next node to visit.
        Simple Logic v1:
        1. Find incomplete prerequisites of the current node (if any).
        2. If current is complete, look for its advanced children (edges: advanced_of).
        3. Fallback: Return None (End of path or manual selection needed).
        """
        
        # 1. Fetch current node to get level/topic
        # (Optimization: pass node object if available)
        
        # 2. Check for unfinished prerequisites (Backtracking)
        # In a real graph, we'd query edges `_to` = current_node_id AND type="prerequisite_of"
        # Then check if those nodes are "completed" (state tracking not technically in Phase 1 models yet)
        # For Phase 3, let's assume "visited" logic is client-side or we just return available paths.
        
        # Let's simplify: Return the first "advanced" node connected to this one.
        # This creates a "Depth-First" forward suggestions.
        
        # Query for outgoing "advanced_of" edges
        # Edge direction: Rule was Root -> Advanced via "advanced_of"
        # So we look for edges where _from = current and type = advanced_of
        
        # Convert UUID to Arango ID
        arango_id = f"nodes/{current_node_id}"
        
        aql = """
        FOR edge IN edges
            FILTER edge._from == @current_id AND edge.type == "advanced_of"
            RETURN edge._to
        """
        
        cursor = self.db.db.aql.execute(aql, bind_vars={'current_id': arango_id})
        advanced_node_ids = [doc for doc in cursor]
        
        if advanced_node_ids:
            # Return the first one (simple linear progression suggestion)
            # user likely wants node_id, not "nodes/uuid"
            return advanced_node_ids[0].split('/')[1]
            
        return None

traversal_engine = TraversalEngine()

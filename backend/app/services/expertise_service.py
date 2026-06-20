from app.database.connection import db
from app.services.xp_engine import xp_engine

class ExpertiseService:
    def calculate_user_expertise(self, user_id: str) -> dict:
        """
        Aggregates user completed nodes across expeditions to calculate domain breadth and depth.
        """
        # Fetch all completed nodes for this user by joining expeditions and nodes
        aql = """
        FOR e IN expeditions
            FILTER e.user_id == @user_id
            FOR n IN nodes
                FILTER n.expedition_id == e._key AND n.completed == true
                RETURN {
                    difficulty_score: n.difficulty_score,
                    primary_domain: n.primary_domain || "General"
                }
        """
        try:
            cursor = db.db.aql.execute(aql, bind_vars={"user_id": user_id})
            completed_nodes = list(cursor)
        except Exception:
            completed_nodes = []
        
        # Group completed nodes by primary_domain
        domain_data = {}
        for node in completed_nodes:
            domain = node.get("primary_domain", "General")
            difficulty = node.get("difficulty_score", 10)
            
            if domain not in domain_data:
                domain_data[domain] = {
                    "nodes_count": 0,
                    "total_difficulty": 0,
                    "domain_xp": 0
                }
            
            domain_data[domain]["nodes_count"] += 1
            domain_data[domain]["total_difficulty"] += difficulty
            # Base XP for the node
            xp = xp_engine.calculate_node_xp(difficulty)
            domain_data[domain]["domain_xp"] += xp
            
        # Calculate stats per domain
        domains_profile = {}
        total_breadth = len(domain_data)
        
        for domain, stats in domain_data.items():
            avg_diff = stats["total_difficulty"] / stats["nodes_count"] if stats["nodes_count"] > 0 else 0
            # Depth = Domain XP * (1 + Average Difficulty / 100)
            depth = stats["domain_xp"] * (1 + avg_diff / 100)
            
            domains_profile[domain] = {
                "domain": domain,
                "articles_completed": stats["nodes_count"],
                "domain_xp": stats["domain_xp"],
                "average_difficulty": round(avg_diff, 1),
                "depth": round(depth, 1)
            }
            
        return {
            "user_id": user_id,
            "breadth": total_breadth,
            "domains": domains_profile
        }

expertise_service = ExpertiseService()

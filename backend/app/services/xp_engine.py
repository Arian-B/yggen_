from app.database.connection import db

class XPEngine:
    def __init__(self):
        self.db = db
        self.REFLECTION_BONUS = 20

    def calculate_node_xp(self, difficulty_score: int) -> int:
        """
        Calculates base XP for visiting a node.
        Formula: 10 + (difficulty_score * 0.5)
        """
        return int(10 + (difficulty_score * 0.5))

    def apply_reflection_bonus(self) -> int:
        """
        Returns the fixed reflection bonus amount.
        """
        return self.REFLECTION_BONUS

    def update_user_xp(self, user_id: str, xp_amount: int):
        """
        Updates the user's total XP and Level in the database.
        Level = floor(total_xp / 100)
        """
        # AQL to atomically update user XP
        # Assuming user_id is the key or we search by it
        # If user_id is internal UUID, we access `users/{user_id}`
        
        aql = """
        LET user = DOCUMENT(CONCAT('users/', @user_id))
        UPDATE user WITH {
            total_xp: user.total_xp + @xp_amount,
            level: FLOOR((user.total_xp + @xp_amount) / 100)
        } IN users
        RETURN NEW
        """
        
        try:
            cursor = self.db.db.aql.execute(aql, bind_vars={'user_id': user_id, 'xp_amount': xp_amount})
            # We can return the new user stats if needed
            result = [doc for doc in cursor]
            return result[0] if result else None
        except Exception as e:
            print(f"Error updating user XP: {e}")
            return None

xp_engine = XPEngine()

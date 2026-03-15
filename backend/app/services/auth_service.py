"""
Auth Service — handles JWT creation, password hashing,
email/password auth, and Google OAuth2 user resolution.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.database.connection import db

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT config
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days


class AuthService:

    # ── Passwords ──────────────────────────────────────────
    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    # ── JWT ────────────────────────────────────────────────
    def create_access_token(self, user_id: str, email: str) -> str:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {
            "sub": user_id,
            "email": email,
            "exp": expire
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)

    def decode_token(self, token: str) -> Optional[dict]:
        try:
            return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            return None

    # ── ArangoDB user helpers ──────────────────────────────
    def get_user_by_email(self, email: str) -> Optional[dict]:
        try:
            cursor = db.db.aql.execute(
                "FOR u IN users FILTER u.email == @email LIMIT 1 RETURN u",
                bind_vars={"email": email}
            )
            return next(cursor, None)
        except Exception as e:
            logger.error(f"get_user_by_email error: {e}")
            return None

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        try:
            return db.db.collection('users').get(user_id)
        except Exception:
            return None

    def get_user_by_google_id(self, google_id: str) -> Optional[dict]:
        try:
            cursor = db.db.aql.execute(
                "FOR u IN users FILTER u.google_id == @gid LIMIT 1 RETURN u",
                bind_vars={"gid": google_id}
            )
            return next(cursor, None)
        except Exception:
            return None

    def create_user(self, user_id: str, email: str, hashed_password: Optional[str] = None,
                    display_name: Optional[str] = None, avatar_url: Optional[str] = None,
                    google_id: Optional[str] = None) -> dict:
        doc = {
            "_key": user_id,
            "user_id": user_id,
            "email": email,
            "hashed_password": hashed_password,
            "display_name": display_name or email.split("@")[0],
            "avatar_url": avatar_url,
            "google_id": google_id,
            "total_xp": 0,
            "level": 0,
            "created_at": datetime.utcnow().isoformat()
        }
        db.db.collection('users').insert(doc, overwrite=False)
        return doc

    # ── Email/Password Auth ────────────────────────────────
    def register(self, email: str, password: str, display_name: Optional[str] = None) -> dict:
        if self.get_user_by_email(email):
            raise ValueError("Email already registered")
        import uuid
        user_id = str(uuid.uuid4())
        hashed = self.hash_password(password)
        user = self.create_user(user_id=user_id, email=email, hashed_password=hashed,
                                display_name=display_name)
        token = self.create_access_token(user_id, email)
        return {"token": token, "user": user}

    def login(self, email: str, password: str) -> dict:
        user = self.get_user_by_email(email)
        if not user:
            raise ValueError("Invalid email or password")
        if not user.get("hashed_password"):
            raise ValueError("This account uses Google sign-in. Please log in with Google.")
        if not self.verify_password(password, user["hashed_password"]):
            raise ValueError("Invalid email or password")
        token = self.create_access_token(user["_key"], email)
        return {"token": token, "user": user}

    # ── Google OAuth ───────────────────────────────────────
    def get_or_create_google_user(self, google_id: str, email: str,
                                  display_name: Optional[str] = None,
                                  avatar_url: Optional[str] = None) -> dict:
        # Try by google_id first
        user = self.get_user_by_google_id(google_id)
        if user:
            return user

        # Maybe they registered with email/password first — link accounts
        user = self.get_user_by_email(email)
        if user:
            # Link google_id to existing account
            db.db.collection('users').update({"_key": user["_key"], "google_id": google_id})
            user["google_id"] = google_id
            return user

        # Brand new user via Google
        import uuid
        user_id = str(uuid.uuid4())
        user = self.create_user(user_id=user_id, email=email, google_id=google_id,
                                display_name=display_name, avatar_url=avatar_url)
        return user


auth_service = AuthService()

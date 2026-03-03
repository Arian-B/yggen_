"""
Auth Routes — email/password + Google OAuth2
All sessions backed by ArangoDB users collection, issued as JWT tokens.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx

from app.models.user_models import UserLogin, UserRegister, TokenResponse
from app.services.auth_service import auth_service
from app.core.config import settings

router = APIRouter()
security = HTTPBearer(auto_error=False)


# ── Dependency: get current user from JWT ──────────────────────────────────

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = auth_service.decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = auth_service.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Email / Password ───────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse)
async def register(body: UserRegister):
    try:
        result = auth_service.register(
            email=body.email,
            password=body.password,
            display_name=body.display_name
        )
        user = result["user"]
        return TokenResponse(
            access_token=result["token"],
            user_id=user["_key"],
            email=user["email"],
            display_name=user.get("display_name"),
            avatar_url=user.get("avatar_url")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin):
    try:
        result = auth_service.login(email=body.email, password=body.password)
        user = result["user"]
        return TokenResponse(
            access_token=result["token"],
            user_id=user["_key"],
            email=user["email"],
            display_name=user.get("display_name"),
            avatar_url=user.get("avatar_url")
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["_key"],
        "email": current_user.get("email"),
        "display_name": current_user.get("display_name"),
        "avatar_url": current_user.get("avatar_url"),
        "total_xp": current_user.get("total_xp", 0),
        "level": current_user.get("level", 0),
        "has_google": bool(current_user.get("google_id"))
    }


# ── Google OAuth2 ──────────────────────────────────────────────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google")
async def google_login():
    """Redirects the browser to Google's OAuth consent screen."""
    if settings.GOOGLE_CLIENT_ID == "YOUR_GOOGLE_CLIENT_ID_HERE":
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env"
        )
    params = (
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
        f"&prompt=select_account"
    )
    return RedirectResponse(GOOGLE_AUTH_URL + params)


@router.get("/google/callback")
async def google_callback(code: str = None, error: str = None):
    """
    Google redirects here with an authorization code.
    We exchange it for user info, create/find the user, and redirect
    to the frontend with a JWT in the URL fragment.
    """
    if error or not code:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=google_cancelled")

    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for tokens
            token_resp = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code"
            })
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=google_token_failed")

            # Fetch user info from Google
            user_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            profile = user_resp.json()

        google_id = profile.get("sub")
        email = profile.get("email")
        display_name = profile.get("name")
        avatar_url = profile.get("picture")

        if not google_id or not email:
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=google_no_email")

        # Create/find user in ArangoDB
        user = auth_service.get_or_create_google_user(
            google_id=google_id,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url
        )

        # Issue our own JWT
        jwt_token = auth_service.create_access_token(user["_key"], email)

        # Redirect to frontend with token in hash (not query string — safer)
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/auth/callback#token={jwt_token}"
            f"&user_id={user['_key']}"
            f"&display_name={display_name or ''}"
        )

    except Exception:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=server_error")


# ── Wikipedia OAuth 2.0 (Connect only — not primary login) ────────────────

WIKIPEDIA_AUTH_URL     = "https://meta.wikimedia.org/w/rest.php/oauth2/authorize"
WIKIPEDIA_TOKEN_URL    = "https://meta.wikimedia.org/w/rest.php/oauth2/access_token"
WIKIPEDIA_PROFILE_URL  = "https://meta.wikimedia.org/w/rest.php/oauth2/resource/profile"


@router.get("/wikipedia/connect")
async def wikipedia_connect(request: Request):
    """
    Starts Wikipedia OAuth 2.0 to LINK an account (not standalone login).
    Accepts JWT via Authorization: Bearer header OR ?_token= query param
    (query param needed because this is triggered by a browser redirect).
    """
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        token = request.query_params.get("_token")
    if not token:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=not_authenticated")

    payload = auth_service.decode_token(token)
    if not payload:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=invalid_token")

    user_id = payload.get("sub")
    if not settings.WIKIPEDIA_CLIENT_ID or settings.WIKIPEDIA_CLIENT_ID == "YOUR_WIKIPEDIA_CLIENT_ID_HERE":
        return RedirectResponse(f"{settings.FRONTEND_URL}/settings?error=wikipedia_not_configured")

    import urllib.parse
    params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": settings.WIKIPEDIA_CLIENT_ID,
        "redirect_uri": settings.WIKIPEDIA_REDIRECT_URI,
        "scope": "basic",
        "state": user_id
    })
    return RedirectResponse(f"{WIKIPEDIA_AUTH_URL}?{params}")



@router.get("/wikipedia/callback")
async def wikipedia_callback(code: str = None, state: str = None, error: str = None):
    """
    MediaWiki redirects here. Exchange code for token, fetch profile,
    link the Wikipedia username to the user identified by `state`.
    """
    if error or not code or not state:
        return RedirectResponse(f"{settings.FRONTEND_URL}/settings?error=wikipedia_cancelled")

    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(WIKIPEDIA_TOKEN_URL, data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.WIKIPEDIA_CLIENT_ID,
                "client_secret": settings.WIKIPEDIA_CLIENT_SECRET,
                "redirect_uri": settings.WIKIPEDIA_REDIRECT_URI
            })
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                return RedirectResponse(f"{settings.FRONTEND_URL}/settings?error=wikipedia_token_failed")

            profile_resp = await client.get(
                WIKIPEDIA_PROFILE_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            profile = profile_resp.json()

        wikipedia_id  = str(profile.get("sub", ""))
        username      = profile.get("username", "")
        user_id       = state  # The wikiyggen_ user_id passed as state

        if not wikipedia_id or not user_id:
            return RedirectResponse(f"{settings.FRONTEND_URL}/settings?error=wikipedia_no_profile")

        # Link to user document
        from app.database.connection import db
        user_doc = db.db.collection('users').get(user_id)
        if user_doc:
            db.db.collection('users').update({
                "_key": user_id,
                "wikipedia_id": wikipedia_id,
                "wikipedia_username": username
            })

        return RedirectResponse(
            f"{settings.FRONTEND_URL}/settings?connected=wikipedia&username={username}"
        )

    except Exception:
        return RedirectResponse(f"{settings.FRONTEND_URL}/settings?error=wikipedia_server_error")


# ── Connected Accounts ─────────────────────────────────────────────────────

@router.get("/connected-accounts")
async def get_connected_accounts(current_user: dict = Depends(get_current_user)):
    """Returns which third-party accounts are connected to the current user."""
    return {
        "google": {
            "connected": bool(current_user.get("google_id")),
            "identifier": current_user.get("email") if current_user.get("google_id") else None
        },
        "wikipedia": {
            "connected": bool(current_user.get("wikipedia_id")),
            "identifier": current_user.get("wikipedia_username")
        },
        "twitter": {
            "connected": bool(current_user.get("twitter_id")),
            "identifier": current_user.get("twitter_username")
        }
    }


@router.delete("/connected-accounts/{provider}")
async def disconnect_account(provider: str, current_user: dict = Depends(get_current_user)):
    """Unlinks a connected provider account."""
    from app.database.connection import db
    PROVIDER_FIELDS = {
        "google":    ["google_id"],
        "wikipedia": ["wikipedia_id", "wikipedia_username"],
        "twitter":   ["twitter_id", "twitter_username"]
    }
    if provider not in PROVIDER_FIELDS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    update = {"_key": current_user["_key"]}
    for field in PROVIDER_FIELDS[provider]:
        update[field] = None
    db.db.collection('users').update(update)
    return {"disconnected": provider}


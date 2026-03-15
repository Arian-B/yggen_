"""
Auth Routes — email/password + Google OAuth2
All sessions backed by ArangoDB users collection, issued as JWT tokens.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx, os, pathlib

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
async def wikipedia_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """
    MediaWiki redirects here. Exchange code for token, fetch profile,
    link the Wikipedia username to the user identified by `state`.
    """
    import logging as _logging, traceback as _tb
    _log = _logging.getLogger(__name__)

    # Log EVERYTHING Wikimedia sends so we can diagnose any error
    _log.info(f"[WP callback] ALL params: {dict(request.query_params)}")

    if error or not code or not state:
        error_desc = request.query_params.get("error_description", "")
        _log.warning(f"[WP callback] early exit: error={error!r}, desc={error_desc!r}, code={'yes' if code else 'no'}, state={'yes' if state else 'no'}")
        return RedirectResponse(f"{settings.FRONTEND_URL}/settings?error=wikipedia_cancelled")


    try:
        WP_UA = "wikiyggen_/1.0 (https://github.com/Arian-B/yggen_; contact@wikiyggen.dev)"
        async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": WP_UA}) as client:
            # Wikimedia OAuth 2.0: send credentials in POST body (client_secret_post)
            token_resp = await client.post(
                WIKIPEDIA_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": settings.WIKIPEDIA_CLIENT_ID,
                    "client_secret": settings.WIKIPEDIA_CLIENT_SECRET,
                    "redirect_uri": settings.WIKIPEDIA_REDIRECT_URI
                },
                headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": WP_UA}
            )
            _log.info(f"[WP token] status={token_resp.status_code} body={token_resp.text[:800]}")

            # If POST body failed, try Basic Auth fallback
            if token_resp.status_code != 200:
                import base64
                creds_b64 = base64.b64encode(
                    f"{settings.WIKIPEDIA_CLIENT_ID}:{settings.WIKIPEDIA_CLIENT_SECRET}".encode()
                ).decode()
                token_resp = await client.post(
                    WIKIPEDIA_TOKEN_URL,
                    data={"grant_type": "authorization_code", "code": code, "redirect_uri": settings.WIKIPEDIA_REDIRECT_URI},
                    headers={"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {creds_b64}"}
                )
                _log.info(f"[WP token basic-auth] status={token_resp.status_code} body={token_resp.text[:800]}")

            if token_resp.status_code != 200:
                import urllib.parse as _up
                err_msg = _up.quote(token_resp.text[:200])
                _log.error(f"[WP token] both methods FAILED: {token_resp.text}")
                return RedirectResponse(f"{settings.FRONTEND_URL}/settings?error=wikipedia_token_failed&detail={err_msg}")

            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                _log.error(f"[WP token] no access_token in: {token_data}")
                return RedirectResponse(f"{settings.FRONTEND_URL}/settings?error=wikipedia_token_failed&detail=no_access_token")

            profile_resp = await client.get(
                WIKIPEDIA_PROFILE_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            _log.info(f"[WP profile] status={profile_resp.status_code} body={profile_resp.text[:400]}")
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
        _log.error(f"Wikipedia callback exception:\n{_tb.format_exc()}")
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


# ── Avatar Upload ─────────────────────────────────────────────────────────────

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a profile picture. Accepts JPEG/PNG/GIF/WebP up to 5 MB.
    Saves to static/avatars/{user_id}.ext and updates avatar_url in ArangoDB.
    """
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    MAX_SIZE = 5 * 1024 * 1024  # 5 MB

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Use JPEG, PNG, GIF, or WebP. Got: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5 MB.")

    ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp"}
    ext = ext_map[file.content_type]
    user_id = current_user["_key"]
    filename = f"{user_id}.{ext}"

    avatar_dir = pathlib.Path("static/avatars")
    avatar_dir.mkdir(parents=True, exist_ok=True)
    # Remove old avatars for this user
    for old in avatar_dir.glob(f"{user_id}.*"):
        old.unlink(missing_ok=True)

    (avatar_dir / filename).write_bytes(contents)

    avatar_url = f"{settings.BACKEND_URL}/static/avatars/{filename}"

    from app.database.connection import db
    db.db.collection('users').update({"_key": user_id, "avatar_url": avatar_url})

    return {"avatar_url": avatar_url}

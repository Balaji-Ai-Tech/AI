from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.models import OAuthLoginCode, User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix='/api/auth', tags=['Authentication'])


def user_response(user: User) -> UserResponse:
    return UserResponse(id=user.id, name=user.name, email=user.email, role=user.role)


def auth_response(user: User) -> AuthResponse:
    return AuthResponse(access_token=create_access_token(user.id), user=user_response(user))


@router.post('/register', response_model=AuthResponse, status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    email = str(req.email).lower().strip()
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise HTTPException(409, 'Email already registered. Sign in instead.')
    user = User(name=req.name.strip(), email=email, password_hash=hash_password(req.password), role='operator')
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return auth_response(user)


@router.post('/login', response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    email = str(req.email).lower().strip()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, 'Invalid email or password')
    return auth_response(user)


@router.post('/guest', response_model=AuthResponse)
async def guest_login(db: AsyncSession = Depends(get_db)):
    # Guest data is persisted like other accounts, but receives a distinct guest role.
    for _ in range(3):
        guest_email = f'guest-{secrets.token_hex(10)}@guest.transformhub.local'
        exists = (await db.execute(select(User.id).where(User.email == guest_email))).scalar_one_or_none()
        if not exists:
            break
    user = User(name='Guest User', email=guest_email, password_hash=hash_password(secrets.token_urlsafe(48)), role='guest')
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return auth_response(user)


@router.get('/me', response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user_response(user)


_PROVIDER_CONFIG = {
    'google': {
        'client_id': lambda: settings.GOOGLE_CLIENT_ID,
        'client_secret': lambda: settings.GOOGLE_CLIENT_SECRET,
        'authorize_url': 'https://accounts.google.com/o/oauth2/v2/auth',
        'token_url': 'https://oauth2.googleapis.com/token',
        'userinfo_url': 'https://openidconnect.googleapis.com/v1/userinfo',
        'scope': 'openid email profile',
    },
    'facebook': {
        'client_id': lambda: settings.FACEBOOK_CLIENT_ID,
        'client_secret': lambda: settings.FACEBOOK_CLIENT_SECRET,
        'authorize_url': lambda: f'https://www.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/dialog/oauth',
        'token_url': lambda: f'https://graph.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/oauth/access_token',
        'userinfo_url': lambda: f'https://graph.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/me',
        'scope': 'email,public_profile',
    },
    'x': {
        'client_id': lambda: settings.X_CLIENT_ID,
        'client_secret': lambda: settings.X_CLIENT_SECRET,
        'authorize_url': 'https://twitter.com/i/oauth2/authorize',
        'token_url': 'https://api.x.com/2/oauth2/token',
        'userinfo_url': 'https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url',
        'scope': 'users.read tweet.read offline.access',
    },
    'linkedin': {
        'client_id': lambda: settings.LINKEDIN_CLIENT_ID,
        'client_secret': lambda: settings.LINKEDIN_CLIENT_SECRET,
        'authorize_url': 'https://www.linkedin.com/oauth/v2/authorization',
        'token_url': 'https://www.linkedin.com/oauth/v2/accessToken',
        'userinfo_url': 'https://api.linkedin.com/v2/userinfo',
        'scope': 'openid profile email',
    },
}


def _value(item):
    return item() if callable(item) else item


def _frontend_url() -> str:
    return settings.FRONTEND_URL.rstrip('/')


def _callback_url(provider: str) -> str:
    return f'{settings.BACKEND_PUBLIC_URL.rstrip("/")}/api/auth/oauth/{provider}/callback'


def _provider_ready(provider: str) -> bool:
    cfg = _PROVIDER_CONFIG[provider]
    return bool(_value(cfg['client_id']) and _value(cfg['client_secret']))


def _pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
    return verifier, challenge


@router.get('/providers')
async def provider_status():
    # Only boolean readiness is exposed; credentials and secrets are never returned.
    return {name: _provider_ready(name) for name in _PROVIDER_CONFIG}


@router.get('/oauth/{provider}')
async def oauth_start(provider: str, request: Request):
    provider = provider.lower()
    if provider not in _PROVIDER_CONFIG:
        raise HTTPException(404, 'Unsupported social provider')
    if not _provider_ready(provider):
        raise HTTPException(503, f'{provider.title()} OAuth is not configured. Add its client ID and secret to backend/.env.')

    cfg = _PROVIDER_CONFIG[provider]
    state = secrets.token_urlsafe(32)
    request.session['oauth_state'] = state
    request.session['oauth_provider'] = provider
    params = {
        'response_type': 'code',
        'client_id': _value(cfg['client_id']),
        'redirect_uri': _callback_url(provider),
        'scope': _value(cfg['scope']),
        'state': state,
    }
    if provider == 'google':
        params['access_type'] = 'offline'
        params['prompt'] = 'select_account'
    elif provider == 'x':
        verifier, challenge = _pkce_pair()
        request.session['oauth_code_verifier'] = verifier
        params['code_challenge'] = challenge
        params['code_challenge_method'] = 'S256'
    authorize_url = _value(cfg['authorize_url'])
    return RedirectResponse(f'{authorize_url}?{urlencode(params)}', status_code=302)


async def _exchange_code(provider: str, code: str, request: Request) -> dict:
    cfg = _PROVIDER_CONFIG[provider]
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': _callback_url(provider),
        'client_id': _value(cfg['client_id']),
    }
    headers = {'Accept': 'application/json'}
    if provider == 'x':
        data['code_verifier'] = request.session.get('oauth_code_verifier', '')
        basic = base64.b64encode(f"{_value(cfg['client_id'])}:{_value(cfg['client_secret'])}".encode()).decode()
        headers['Authorization'] = f'Basic {basic}'
    else:
        data['client_secret'] = _value(cfg['client_secret'])
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        response = await client.post(_value(cfg['token_url']), data=data, headers=headers)
    if response.status_code >= 400:
        raise HTTPException(502, f'{provider.title()} token exchange failed. Check provider settings and callback URL.')
    return response.json()


async def _get_profile(provider: str, token: dict) -> dict:
    access_token = token.get('access_token')
    if not access_token:
        raise HTTPException(502, f'{provider.title()} did not return an access token')
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {'fields': 'id,name,email'} if provider == 'facebook' else {}
    if provider == 'facebook':
        headers = {}
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        response = await client.get(_value(_PROVIDER_CONFIG[provider]['userinfo_url']), headers=headers, params=params)
    if response.status_code >= 400:
        raise HTTPException(502, f'{provider.title()} profile request failed. Confirm the requested permissions are enabled.')
    return response.json()


def _normalise_profile(provider: str, profile: dict) -> tuple[str, str, str]:
    if provider == 'google':
        subject = str(profile.get('sub', ''))
        email = (profile.get('email') or '').lower().strip()
        name = profile.get('name') or profile.get('given_name') or 'Google User'
    elif provider == 'facebook':
        subject = str(profile.get('id', ''))
        email = (profile.get('email') or '').lower().strip()
        name = profile.get('name') or 'Facebook User'
    elif provider == 'x':
        data = profile.get('data') or {}
        subject = str(data.get('id', ''))
        email = ''
        name = data.get('name') or data.get('username') or 'X User'
    elif provider == 'linkedin':
        subject = str(profile.get('sub', ''))
        email = (profile.get('email') or '').lower().strip()
        name = profile.get('name') or 'LinkedIn User'
    else:
        raise HTTPException(400, 'Unsupported social provider')
    if not subject:
        raise HTTPException(502, f'{provider.title()} did not return a user ID')
    if not email:
        email = f'{provider}-{subject}@oauth.transformhub.local'
    return email, str(name).strip()[:150] or f'{provider.title()} User', subject


@router.get('/oauth/{provider}/callback')
async def oauth_callback(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    provider = provider.lower()
    if provider not in _PROVIDER_CONFIG:
        raise HTTPException(404, 'Unsupported social provider')
    error = request.query_params.get('error')
    if error:
        safe_error = urlencode({'oauth_error': error})
        return RedirectResponse(f'{_frontend_url()}/?{safe_error}')

    expected_state = request.session.pop('oauth_state', None)
    expected_provider = request.session.pop('oauth_provider', None)
    if not expected_state or not secrets.compare_digest(str(expected_state), str(request.query_params.get('state', ''))) or expected_provider != provider:
        raise HTTPException(400, 'OAuth state validation failed. Please try again.')
    code = request.query_params.get('code')
    if not code:
        raise HTTPException(400, 'OAuth authorization code is missing')

    try:
        token = await _exchange_code(provider, code, request)
        profile = await _get_profile(provider, token)
        email, name, _subject = _normalise_profile(provider, profile)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f'{provider.title()} sign-in failed. Check provider configuration and network access.') from exc
    finally:
        request.session.pop('oauth_code_verifier', None)

    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not user:
        user = User(name=name, email=email, password_hash=hash_password(secrets.token_urlsafe(48)), role='operator')
        db.add(user)
        await db.flush()

    # Exchange the provider identity for a short-lived, single-use code so the application JWT
    # does not appear in browser history, referrer headers, or copied URLs.
    raw_code = secrets.token_urlsafe(40)
    code_row = OAuthLoginCode(
        code_hash=hashlib.sha256(raw_code.encode()).hexdigest(),
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=2),
    )
    db.add(code_row)
    await db.commit()
    return RedirectResponse(f'{_frontend_url()}/?{urlencode({"oauth_code": raw_code})}', status_code=302)


class OAuthExchangeRequest(BaseModel):
    code: str = Field(min_length=20, max_length=200)


@router.post('/oauth/exchange', response_model=AuthResponse)
async def oauth_exchange(req: OAuthExchangeRequest, db: AsyncSession = Depends(get_db)):
    digest = hashlib.sha256(req.code.encode()).hexdigest()
    row = (await db.execute(select(OAuthLoginCode).where(OAuthLoginCode.code_hash == digest))).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if not row or row.consumed_at is not None or row.expires_at <= now:
        raise HTTPException(400, 'Sign-in link expired or was already used. Please sign in again.')
    row.consumed_at = now
    user = (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()
    if not user:
        await db.commit()
        raise HTTPException(401, 'Account for this sign-in was not found.')
    await db.commit()
    return auth_response(user)

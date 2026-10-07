"""Our own tokens: short-lived signed access tokens and opaque refresh tokens."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.config import get_settings

ALGORITHM = "HS256"
ACCESS_TOKEN_TYPE = "access"


class InvalidAccessToken(Exception):
    pass


def create_access_token(user_id: uuid.UUID, session_id: uuid.UUID) -> tuple[str, int]:
    """Returns (token, seconds until expiry)."""
    settings = get_settings()
    now = datetime.now(UTC)
    ttl = timedelta(minutes=settings.access_token_minutes)
    claims = {
        "sub": str(user_id),
        "sid": str(session_id),
        "typ": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=ALGORITHM), int(ttl.total_seconds())


def decode_access_token(token: str) -> tuple[uuid.UUID, uuid.UUID]:
    """Returns (user_id, session_id) or raises InvalidAccessToken."""
    try:
        claims = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "sid", "exp", "iat"]},
        )
        if claims.get("typ") != ACCESS_TOKEN_TYPE:
            raise InvalidAccessToken("wrong token type")
        return uuid.UUID(claims["sub"]), uuid.UUID(claims["sid"])
    except (jwt.PyJWTError, ValueError) as exc:
        raise InvalidAccessToken(str(exc)) from exc


def new_refresh_token() -> str:
    """Opaque, unguessable. Only its hash is stored."""
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    # A fast hash is fine here: the token is 256 random bits, not a password.
    return hashlib.sha256(token.encode()).hexdigest()

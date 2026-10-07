"""Shared request dependencies: the signed-in user and the ID token verifier."""

from datetime import UTC, datetime
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db import SessionDep
from app.id_tokens import IdTokenVerifier, build_verifier
from app.models import AuthSession, User
from app.security import InvalidAccessToken, decode_access_token

bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Not signed in") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    db: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if credentials is None:
        raise _unauthorized()
    try:
        user_id, session_id = decode_access_token(credentials.credentials)
    except InvalidAccessToken as exc:
        raise _unauthorized("Invalid or expired access token") from exc

    # Checking the session makes sign-out take effect immediately, not after expiry.
    auth_session = await db.get(AuthSession, session_id)
    if (
        auth_session is None
        or auth_session.user_id != user_id
        or auth_session.revoked_at is not None
        or auth_session.expires_at <= datetime.now(UTC)
    ):
        raise _unauthorized("Session ended")

    user = await db.get(User, user_id)
    if user is None:
        raise _unauthorized("Account no longer exists")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


@lru_cache
def get_id_token_verifier() -> IdTokenVerifier:
    return build_verifier()


VerifierDep = Annotated[IdTokenVerifier, Depends(get_id_token_verifier)]

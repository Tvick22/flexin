"""Sign-in, sessions and refresh-token rotation."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.id_tokens import VerifiedIdentity
from app.models import AuthIdentity, AuthSession, User
from app.security import create_access_token, hash_refresh_token, new_refresh_token


class RefreshRejected(Exception):
    pass


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    expires_in: int


def _clean_name(name: str | None) -> str | None:
    name = " ".join((name or "").split())
    return name[:50] or None


async def sign_in(
    db: AsyncSession, identity: VerifiedIdentity, name_hint: str | None = None
) -> tuple[User, bool]:
    """Find or create the account for a verified provider identity.

    Returns (user, is_new_user). Lookup is by the provider's stable `sub`. A new
    identity is linked to an existing account only when the provider has
    verified the same email (e.g. Google on Android after Apple on iPhone);
    otherwise a new account is created.
    """
    now = datetime.now(UTC)
    linked = await db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == identity.provider,
            AuthIdentity.subject == identity.subject,
        )
    )
    if linked is not None:
        linked.last_used_at = now
        if identity.email:
            linked.email = identity.email
        user = await db.get(User, linked.user_id)
        assert user is not None  # FK + cascade guarantee this
        await db.commit()
        return user, False

    verified_email = identity.email if identity.email_verified else None
    user = None
    if verified_email:
        user = await db.scalar(select(User).where(func.lower(User.email) == verified_email.lower()))
        if user is not None and await _has_provider(db, user.id, identity.provider):
            # Same email, but that account already has a different identity from this
            # provider. Don't merge; keep the existing account's email untouched.
            user, verified_email = None, None

    is_new = user is None
    if user is None:
        user = User(email=verified_email, name=_clean_name(name_hint or identity.name))
        db.add(user)
        await db.flush()

    db.add(
        AuthIdentity(
            user_id=user.id,
            provider=identity.provider,
            subject=identity.subject,
            email=identity.email,
        )
    )
    await db.commit()
    await db.refresh(user)
    return user, is_new


async def _has_provider(db: AsyncSession, user_id: uuid.UUID, provider: str) -> bool:
    found = await db.scalar(
        select(AuthIdentity.id).where(
            AuthIdentity.user_id == user_id, AuthIdentity.provider == provider
        )
    )
    return found is not None


async def start_session(db: AsyncSession, user: User) -> IssuedTokens:
    refresh_token = new_refresh_token()
    auth_session = AuthSession(
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=get_settings().refresh_token_days),
    )
    db.add(auth_session)
    await db.commit()
    access_token, expires_in = create_access_token(user.id, auth_session.id)
    return IssuedTokens(access_token, refresh_token, expires_in)


async def revoke_all_sessions(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=func.now())
    )
    await db.commit()


async def refresh_session(db: AsyncSession, refresh_token: str) -> tuple[User, IssuedTokens]:
    """Rotate: the presented token is spent and a new pair is issued."""
    token_hash = hash_refresh_token(refresh_token)
    now = datetime.now(UTC)

    auth_session = await db.scalar(
        select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
    )
    if auth_session is None:
        # A rotated-out token came back: someone kept a copy. End every session.
        reused = await db.scalar(
            select(AuthSession).where(AuthSession.previous_token_hash == token_hash)
        )
        if reused is not None:
            await revoke_all_sessions(db, reused.user_id)
        raise RefreshRejected("unknown refresh token")

    if auth_session.revoked_at is not None or auth_session.expires_at <= now:
        raise RefreshRejected("session ended")

    user = await db.get(User, auth_session.user_id)
    if user is None:
        raise RefreshRejected("account no longer exists")

    new_token = new_refresh_token()
    auth_session.previous_token_hash = token_hash
    auth_session.refresh_token_hash = hash_refresh_token(new_token)
    auth_session.last_used_at = now
    auth_session.expires_at = now + timedelta(days=get_settings().refresh_token_days)
    await db.commit()

    access_token, expires_in = create_access_token(user.id, auth_session.id)
    return user, IssuedTokens(access_token, new_token, expires_in)


async def end_session(db: AsyncSession, refresh_token: str) -> None:
    """Sign out this device. Unknown tokens are ignored (sign-out always succeeds)."""
    await db.execute(
        update(AuthSession)
        .where(
            AuthSession.refresh_token_hash == hash_refresh_token(refresh_token),
            AuthSession.revoked_at.is_(None),
        )
        .values(revoked_at=func.now())
    )
    await db.commit()

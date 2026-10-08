"""Sign-in, sessions and refresh-token rotation."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import AuthSession, User
from app.passwords import hash_password, needs_rehash, verify_password
from app.security import create_access_token, hash_refresh_token, new_refresh_token


class RefreshRejected(Exception):
    pass


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    expires_in: int


class EmailTaken(Exception):
    pass


class InvalidCredentials(Exception):
    pass


async def _find_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


async def sign_up(db: AsyncSession, email: str, password: str) -> User:
    """Create an account. Raises EmailTaken if the email (any case) already has one."""
    if await _find_by_email(db, email) is not None:
        raise EmailTaken(email)
    user = User(email=email.strip(), password_hash=hash_password(password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:  # lost a race with a simultaneous sign-up
        await db.rollback()
        raise EmailTaken(email) from exc
    await db.refresh(user)
    return user


async def log_in(db: AsyncSession, email: str, password: str) -> User:
    """Raises InvalidCredentials for an unknown email or a wrong password, alike."""
    user = await _find_by_email(db, email)
    if not verify_password(user.password_hash if user else None, password) or user is None:
        raise InvalidCredentials()
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        await db.commit()
    return user


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

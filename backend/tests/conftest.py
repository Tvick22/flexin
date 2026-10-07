"""Test fixtures.

DB tests use a separate `<db>_test` database and are skipped if Postgres is down.
API tests talk to the app in-process with the DB and ID-token verifier swapped out.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from itertools import count

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.db import get_session
from app.deps import get_id_token_verifier
from app.id_tokens import InvalidIdToken, Provider, VerifiedIdentity
from app.main import app
from app.models import Base

DEV_URL = make_url(get_settings().database_url)
TEST_URL = DEV_URL.set(database=f"{DEV_URL.database}_test")


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def _ensure_test_database() -> None:
    admin = create_async_engine(DEV_URL.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        async with admin.connect() as conn:
            exists = await conn.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": TEST_URL.database}
            )
            if not exists:
                await conn.execute(text(f'CREATE DATABASE "{TEST_URL.database}"'))
    finally:
        await admin.dispose()


@pytest.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    """Fresh schema per test (fast enough at this size; switch to migrations + rollback later)."""
    try:
        await _ensure_test_database()
    except OSError as exc:
        pytest.skip(f"Postgres not reachable ({exc}); run `npm run db`")

    test_engine = create_async_engine(TEST_URL, poolclass=NullPool)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield test_engine
    finally:
        await test_engine.dispose()


@pytest.fixture
def sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
async def session(sessionmaker: async_sessionmaker[AsyncSession]) -> AsyncIterator[AsyncSession]:
    async with sessionmaker() as s:
        yield s


@dataclass
class FakeVerifier:
    """Stands in for Apple/Google: `issue()` returns a token that `verify()` accepts."""

    identities: dict[str, VerifiedIdentity] = field(default_factory=dict)
    _ids: count = field(default_factory=count)

    def issue(
        self,
        provider: Provider,
        subject: str,
        email: str | None = None,
        email_verified: bool = True,
        name: str | None = None,
    ) -> str:
        token = f"fake-{provider}-token-{next(self._ids)}"
        self.identities[token] = VerifiedIdentity(provider, subject, email, email_verified, name)
        return token

    def verify(self, provider: Provider, token: str, nonce: str | None) -> VerifiedIdentity:
        identity = self.identities.get(token)
        if identity is None or identity.provider != provider:
            raise InvalidIdToken("unknown test token")
        return identity


@pytest.fixture
def verifier() -> FakeVerifier:
    return FakeVerifier()


@pytest.fixture
async def client(
    sessionmaker: async_sessionmaker[AsyncSession], verifier: FakeVerifier
) -> AsyncIterator[AsyncClient]:
    async def test_session() -> AsyncIterator[AsyncSession]:
        async with sessionmaker() as s:
            yield s

    app.dependency_overrides[get_session] = test_session
    app.dependency_overrides[get_id_token_verifier] = lambda: verifier
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c
    finally:
        app.dependency_overrides.clear()

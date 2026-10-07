"""Test fixtures.

DB tests use a separate `<db>_test` database and are skipped if Postgres is down.
"""

from collections.abc import AsyncIterator

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
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
async def session() -> AsyncIterator[AsyncSession]:
    """Fresh schema per test (fast enough at this size; switch to migrations + rollback later)."""
    try:
        await _ensure_test_database()
    except OSError as exc:
        pytest.skip(f"Postgres not reachable ({exc}); run `npm run db`")

    engine = create_async_engine(TEST_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as s:
            yield s
    finally:
        await engine.dispose()

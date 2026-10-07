import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuthIdentity, User

pytestmark = pytest.mark.anyio


async def new_user(session: AsyncSession) -> User:
    user = User()
    session.add(user)
    await session.flush()
    return user


async def expect_rejected(session: AsyncSession, identity: AuthIdentity) -> None:
    session.add(identity)
    with pytest.raises(DBAPIError):
        await session.commit()
    await session.rollback()


async def test_user_can_link_apple_and_google(session: AsyncSession) -> None:
    user = await new_user(session)
    session.add_all(
        [
            AuthIdentity(user_id=user.id, provider="apple", subject="001234.abc"),
            AuthIdentity(user_id=user.id, provider="google", subject="1098765432"),
        ]
    )
    await session.commit()

    count = await session.scalar(select(func.count()).select_from(AuthIdentity))
    assert count == 2


async def test_provider_identity_belongs_to_one_account(session: AsyncSession) -> None:
    a, b = await new_user(session), await new_user(session)
    session.add(AuthIdentity(user_id=a.id, provider="apple", subject="001234.abc"))
    await session.commit()
    await expect_rejected(
        session, AuthIdentity(user_id=b.id, provider="apple", subject="001234.abc")
    )


async def test_same_subject_on_different_providers_is_fine(session: AsyncSession) -> None:
    a, b = await new_user(session), await new_user(session)
    session.add_all(
        [
            AuthIdentity(user_id=a.id, provider="apple", subject="42"),
            AuthIdentity(user_id=b.id, provider="google", subject="42"),
        ]
    )
    await session.commit()


async def test_one_identity_per_provider_per_user(session: AsyncSession) -> None:
    user = await new_user(session)
    session.add(AuthIdentity(user_id=user.id, provider="google", subject="111"))
    await session.commit()
    await expect_rejected(session, AuthIdentity(user_id=user.id, provider="google", subject="222"))


async def test_provider_must_be_apple_or_google(session: AsyncSession) -> None:
    user = await new_user(session)
    await expect_rejected(session, AuthIdentity(user_id=user.id, provider="facebook", subject="1"))


async def test_deleting_user_deletes_their_identities(session: AsyncSession) -> None:
    user = await new_user(session)
    session.add(AuthIdentity(user_id=user.id, provider="apple", subject="001234.abc"))
    await session.commit()

    await session.delete(user)
    await session.commit()

    count = await session.scalar(select(func.count()).select_from(AuthIdentity))
    assert count == 0

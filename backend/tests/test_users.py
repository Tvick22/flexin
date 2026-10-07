import re
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.codes import CODE_ALPHABET, FRIEND_CODE_PATTERN, generate_friend_code, is_valid_friend_code
from app.models import User

pytestmark = pytest.mark.anyio


def make_user(**overrides: object) -> User:
    fields: dict[str, object] = {
        "email": "trev@example.com",
        "name": "Trevor Vick",
        "handle": "tvick",
    }
    fields.update(overrides)
    return User(**fields)


async def expect_rejected(session: AsyncSession, user: User) -> None:
    """The database refuses the row (constraint violation, or too long for the column)."""
    session.add(user)
    with pytest.raises(DBAPIError):
        await session.commit()
    await session.rollback()


# --- No database needed ------------------------------------------------------


def test_generated_friend_codes_are_valid() -> None:
    for _ in range(500):
        assert is_valid_friend_code(generate_friend_code())


def test_friend_code_pattern_matches_alphabet_exactly() -> None:
    allowed = {c for c in map(chr, range(32, 127)) if re.fullmatch(FRIEND_CODE_PATTERN, c * 8)}
    assert allowed == set(CODE_ALPHABET)


def test_alphabet_matches_the_app() -> None:
    app_source = Path(__file__).parents[2] / "src/utils/friend-code.ts"
    assert f"FRIEND_CODE_ALPHABET = '{CODE_ALPHABET}'" in app_source.read_text()


# --- Database ----------------------------------------------------------------


async def test_create_user_fills_defaults(session: AsyncSession) -> None:
    session.add(make_user())
    await session.commit()

    user = (await session.scalars(select(User))).one()
    assert user.id is not None
    assert is_valid_friend_code(user.friend_code)
    assert user.weight_unit == "lb"
    assert user.avatar_url is None
    assert user.created_at is not None and user.updated_at is not None


async def test_new_sign_up_needs_no_profile_yet(session: AsyncSession) -> None:
    """Apple may withhold name/email; handle comes from onboarding. Several such users can exist."""
    session.add_all([User(), User()])
    await session.commit()

    users = (await session.scalars(select(User))).all()
    assert len(users) == 2
    assert all(u.email is None and u.name is None and u.handle is None for u in users)
    assert users[0].friend_code != users[1].friend_code


async def test_email_is_unique_ignoring_case(session: AsyncSession) -> None:
    session.add(make_user())
    await session.commit()
    await expect_rejected(session, make_user(email="TREV@Example.com", handle="other"))


async def test_handle_is_unique(session: AsyncSession) -> None:
    session.add(make_user())
    await session.commit()
    await expect_rejected(session, make_user(email="other@example.com"))


@pytest.mark.parametrize("handle", ["TVick", "tv", "has space", "a" * 31, "dash-ed"])
async def test_handle_format_is_enforced(session: AsyncSession, handle: str) -> None:
    await expect_rejected(session, make_user(handle=handle))


@pytest.mark.parametrize("code", ["0OIL1234", "abcd2345", "ABCD234", "ABCD-234"])
async def test_friend_code_format_is_enforced(session: AsyncSession, code: str) -> None:
    await expect_rejected(session, make_user(friend_code=code))


async def test_weight_unit_is_lb_or_kg(session: AsyncSession) -> None:
    await expect_rejected(session, make_user(weight_unit="st"))


async def test_name_cannot_be_blank(session: AsyncSession) -> None:
    await expect_rejected(session, make_user(name="   "))


async def test_updated_at_changes_on_update(session: AsyncSession) -> None:
    user = make_user()
    session.add(user)
    await session.commit()
    created = user.updated_at

    user.name = "Trev"
    await session.commit()
    await session.refresh(user)
    assert user.updated_at > created

"""Friend requests and friendships."""

import re
import uuid

from sqlalchemy import delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FriendRequest, Friendship, User
from app.schemas import FriendRead, FriendRequestRead, UserSummary


class FriendError(Exception):
    """A request that can't be done. `status` is the HTTP status to answer with."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def _summary(user: User) -> UserSummary:
    # Only onboarded users take part in friends, so name and handle are set.
    return UserSummary(
        id=user.id,
        name=user.name or user.handle or "",
        handle=user.handle or "",
        avatar_url=user.avatar_url,
    )


def _first_name(user: User) -> str:
    return (user.name or user.handle or "them").split(" ")[0]


def normalize_code(raw: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", raw).upper()


async def _are_friends(db: AsyncSession, a: uuid.UUID, b: uuid.UUID) -> bool:
    low, high = Friendship.pair(a, b)
    return await db.get(Friendship, (low, high)) is not None


async def list_friends(db: AsyncSession, me: User) -> list[FriendRead]:
    rows = (
        await db.execute(
            select(Friendship, User)
            .join(
                User,
                or_(
                    (Friendship.user_low_id == me.id) & (User.id == Friendship.user_high_id),
                    (Friendship.user_high_id == me.id) & (User.id == Friendship.user_low_id),
                ),
            )
            .order_by(Friendship.created_at.desc())
        )
    ).all()
    return [FriendRead(user=_summary(user), since=f.created_at) for f, user in rows]


async def list_requests(db: AsyncSession, me: User) -> list[FriendRequestRead]:
    rows = (
        await db.execute(
            select(FriendRequest, User)
            .join(
                User,
                or_(
                    (FriendRequest.to_user_id == me.id) & (User.id == FriendRequest.from_user_id),
                    (FriendRequest.from_user_id == me.id) & (User.id == FriendRequest.to_user_id),
                ),
            )
            .order_by(FriendRequest.created_at.desc())
        )
    ).all()
    return [
        FriendRequestRead(
            id=r.id,
            direction="incoming" if r.to_user_id == me.id else "outgoing",
            user=_summary(user),
            created_at=r.created_at,
        )
        for r, user in rows
    ]


async def send_request(db: AsyncSession, me: User, raw_code: str) -> FriendRequestRead:
    code = normalize_code(raw_code)
    if code == me.friend_code:
        raise FriendError(400, "That's your own friend code.")

    # Only people who've finished onboarding can be found by code.
    them = await db.scalar(select(User).where(User.friend_code == code, User.handle.is_not(None)))
    if them is None:
        raise FriendError(404, "No one has that friend code. Double-check it and try again.")
    name = _first_name(them)

    if await _are_friends(db, me.id, them.id):
        raise FriendError(409, f"You're already friends with {name}.")
    existing = await db.scalar(
        select(FriendRequest).where(
            or_(
                (FriendRequest.from_user_id == me.id) & (FriendRequest.to_user_id == them.id),
                (FriendRequest.from_user_id == them.id) & (FriendRequest.to_user_id == me.id),
            )
        )
    )
    if existing is not None:
        if existing.from_user_id == me.id:
            raise FriendError(409, f"You already sent {name} a request.")
        raise FriendError(409, f"{name} already sent you a request. Accept it in Requests.")

    request = FriendRequest(from_user_id=me.id, to_user_id=them.id)
    db.add(request)
    try:
        await db.commit()
    except IntegrityError as exc:  # a simultaneous identical request won the race
        await db.rollback()
        raise FriendError(409, f"You already sent {name} a request.") from exc
    await db.refresh(request)
    return FriendRequestRead(
        id=request.id, direction="outgoing", user=_summary(them), created_at=request.created_at
    )


async def accept_request(db: AsyncSession, me: User, request_id: uuid.UUID) -> FriendRead:
    request = await db.scalar(
        select(FriendRequest).where(
            FriendRequest.id == request_id, FriendRequest.to_user_id == me.id
        )
    )
    if request is None:
        raise FriendError(404, "That request no longer exists.")
    them = await db.get(User, request.from_user_id)
    assert them is not None  # cascade deletes requests with their users

    low, high = Friendship.pair(me.id, them.id)
    friendship = await db.get(Friendship, (low, high))
    if friendship is None:
        friendship = Friendship(user_low_id=low, user_high_id=high)
        db.add(friendship)
    await db.delete(request)
    await db.commit()
    await db.refresh(friendship)
    return FriendRead(user=_summary(them), since=friendship.created_at)


async def delete_request(db: AsyncSession, me: User, request_id: uuid.UUID) -> None:
    """Decline an incoming request or cancel one you sent."""
    result = await db.execute(
        delete(FriendRequest).where(
            FriendRequest.id == request_id,
            or_(FriendRequest.from_user_id == me.id, FriendRequest.to_user_id == me.id),
        )
    )
    if result.rowcount == 0:
        raise FriendError(404, "That request no longer exists.")
    await db.commit()


async def unfriend(db: AsyncSession, me: User, user_id: uuid.UUID) -> None:
    low, high = Friendship.pair(me.id, user_id)
    result = await db.execute(
        delete(Friendship).where(Friendship.user_low_id == low, Friendship.user_high_id == high)
    )
    if result.rowcount == 0:
        raise FriendError(404, "You're not friends with that user.")
    await db.commit()

import uuid

from fastapi import APIRouter, HTTPException, Response, status

from app.db import SessionDep
from app.deps import OnboardedUser
from app.schemas import FriendRead, FriendRequestRead, SendFriendRequest
from app.services import friends as friends_service
from app.services.friends import FriendError

router = APIRouter(prefix="/friends", tags=["friends"])


def _http(exc: FriendError) -> HTTPException:
    return HTTPException(exc.status, exc.message)


@router.get("")
async def list_friends(me: OnboardedUser, db: SessionDep) -> list[FriendRead]:
    """Your friends, most recent first."""
    return await friends_service.list_friends(db, me)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unfriend(user_id: uuid.UUID, me: OnboardedUser, db: SessionDep) -> Response:
    try:
        await friends_service.unfriend(db, me, user_id)
    except FriendError as exc:
        raise _http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/requests")
async def list_requests(me: OnboardedUser, db: SessionDep) -> list[FriendRequestRead]:
    """Pending requests: `incoming` (to you) and `outgoing` (from you), newest first."""
    return await friends_service.list_requests(db, me)


@router.post("/requests", status_code=status.HTTP_201_CREATED)
async def send_request(
    body: SendFriendRequest, me: OnboardedUser, db: SessionDep
) -> FriendRequestRead:
    """Send a request by friend code. 404 unknown code, 400 your own, 409 already
    friends / already requested (either direction)."""
    try:
        return await friends_service.send_request(db, me, body.friend_code)
    except FriendError as exc:
        raise _http(exc) from exc


@router.post("/requests/{request_id}/accept")
async def accept_request(request_id: uuid.UUID, me: OnboardedUser, db: SessionDep) -> FriendRead:
    """Accept a request sent to you. You're now friends."""
    try:
        return await friends_service.accept_request(db, me, request_id)
    except FriendError as exc:
        raise _http(exc) from exc


@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_request(request_id: uuid.UUID, me: OnboardedUser, db: SessionDep) -> Response:
    """Decline a request sent to you, or cancel one you sent."""
    try:
        await friends_service.delete_request(db, me, request_id)
    except FriendError as exc:
        raise _http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)

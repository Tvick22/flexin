from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db import SessionDep
from app.deps import CurrentUser
from app.models import User
from app.schemas import HandleAvailability, MeRead, MeUpdate, normalize_handle

router = APIRouter(tags=["me"])


@router.get("/me")
async def read_me(user: CurrentUser) -> MeRead:
    return MeRead.model_validate(user)


@router.patch("/me")
async def update_me(body: MeUpdate, user: CurrentUser, db: SessionDep) -> MeRead:
    """Edit your profile. Also how onboarding sets name + handle."""
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        # Validation already covered formats, so a conflict here is the unique handle.
        raise HTTPException(status.HTTP_409_CONFLICT, "That handle is taken.") from exc
    await db.refresh(user)
    return MeRead.model_validate(user)


@router.get("/handles/{handle}")
async def check_handle(handle: str, user: CurrentUser, db: SessionDep) -> HandleAvailability:
    """Live availability check while picking a handle in onboarding."""
    try:
        normalized = normalize_handle(handle)
    except (ValueError, ValidationError):
        return HandleAvailability(handle=handle, available=False, reason="invalid")
    owner = await db.scalar(select(User.id).where(User.handle == normalized))
    if owner is not None and owner != user.id:
        return HandleAvailability(handle=normalized, available=False, reason="taken")
    return HandleAvailability(handle=normalized, available=True)

"""DEVELOPMENT ONLY: sign in as a test account without Apple/Google.

Registered by app/main.py only when ENVIRONMENT=development, so it doesn't exist
in production. Lets the app's whole flow run on web and simulators before real
provider credentials are configured.
"""

from fastapi import APIRouter
from pydantic import Field
from sqlalchemy import func, select

from app.db import SessionDep
from app.models import User
from app.schemas import CamelModel, MeRead, TokenResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth (development only)"])


class DevSignIn(CamelModel):
    # Plain pattern on purpose: test domains like .local aren't "real" emails.
    email: str = Field(default="dev@flexin.local", pattern=r"^[^@\s]+@[^@\s]+$", max_length=320)


@router.post("/dev")
async def dev_sign_in(body: DevSignIn, db: SessionDep) -> TokenResponse:
    """Sign in (creating the account if needed) as the given test email."""
    user = await db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    is_new = user is None
    if user is None:
        user = User(email=body.email)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    tokens = await auth_service.start_session(db, user)
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=MeRead.model_validate(user),
        is_new_user=is_new,
    )

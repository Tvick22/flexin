from fastapi import APIRouter, HTTPException, Response, status

from app.db import SessionDep
from app.models import User
from app.schemas import LogIn, MeRead, RefreshRequest, SignUp, TokenResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


async def _issue(db: SessionDep, user: User, is_new_user: bool = False) -> TokenResponse:
    tokens = await auth_service.start_session(db, user)
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=MeRead.model_validate(user),
        is_new_user=is_new_user,
    )


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def sign_up(body: SignUp, db: SessionDep) -> TokenResponse:
    """Create an account with email + password and sign in. Onboarding comes next."""
    try:
        user = await auth_service.sign_up(db, body.email, body.password)
    except auth_service.EmailTaken as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with that email already exists. Sign in instead."
        ) from exc
    return await _issue(db, user, is_new_user=True)


@router.post("/login")
async def log_in(body: LogIn, db: SessionDep) -> TokenResponse:
    """Sign in with email + password."""
    try:
        user = await auth_service.log_in(db, body.email, body.password)
    except auth_service.InvalidCredentials as exc:
        # Same message either way, so this can't be used to check which emails exist.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.") from exc
    return await _issue(db, user)


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: SessionDep) -> TokenResponse:
    """New access + refresh token pair. The refresh token sent is used up."""
    try:
        user, tokens = await auth_service.refresh_session(db, body.refresh_token)
    except auth_service.RefreshRejected as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in again") from exc
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=MeRead.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, db: SessionDep) -> Response:
    """Sign out this device."""
    await auth_service.end_session(db, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

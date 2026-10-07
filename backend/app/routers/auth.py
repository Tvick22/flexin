from fastapi import APIRouter, HTTPException, Response, status

from app.db import SessionDep
from app.deps import VerifierDep
from app.id_tokens import InvalidIdToken, Provider, ProviderUnavailable
from app.schemas import (
    AppleSignIn,
    GoogleSignIn,
    MeRead,
    RefreshRequest,
    TokenResponse,
)
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


async def _sign_in(
    db: SessionDep,
    verifier: VerifierDep,
    provider: Provider,
    token: str,
    nonce: str | None,
    name_hint: str | None = None,
) -> TokenResponse:
    try:
        identity = verifier.verify(provider, token, nonce)
    except InvalidIdToken as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Sign-in failed: {exc}") from exc
    except ProviderUnavailable as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, f"Couldn't reach {provider}. Try again."
        ) from exc

    user, is_new = await auth_service.sign_in(db, identity, name_hint)
    tokens = await auth_service.start_session(db, user)
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=MeRead.model_validate(user),
        is_new_user=is_new,
    )


@router.post("/apple")
async def sign_in_with_apple(
    body: AppleSignIn, db: SessionDep, verifier: VerifierDep
) -> TokenResponse:
    """Exchange an Apple identity token for Flexin' tokens. Creates the account if new."""
    name = " ".join(p for p in (body.given_name, body.family_name) if p) or None
    return await _sign_in(db, verifier, "apple", body.identity_token, body.nonce, name)


@router.post("/google")
async def sign_in_with_google(
    body: GoogleSignIn, db: SessionDep, verifier: VerifierDep
) -> TokenResponse:
    """Exchange a Google ID token for Flexin' tokens. Creates the account if new."""
    return await _sign_in(db, verifier, "google", body.id_token, body.nonce)


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

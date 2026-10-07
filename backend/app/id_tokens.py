"""Verifying the ID tokens Apple and Google hand the app at sign-in.

The app sends us the provider's ID token (a JWT). We check its signature
against the provider's published keys, plus issuer, audience (our app),
expiry and, when used, the nonce. Only then do we trust `sub` and `email`.
"""

import hashlib
from dataclasses import dataclass
from typing import Literal, Protocol

import jwt

from app.config import get_settings

Provider = Literal["apple", "google"]


@dataclass(frozen=True)
class ProviderConfig:
    jwks_url: str
    issuers: tuple[str, ...]


PROVIDERS: dict[Provider, ProviderConfig] = {
    "apple": ProviderConfig(
        jwks_url="https://appleid.apple.com/auth/keys",
        issuers=("https://appleid.apple.com",),
    ),
    "google": ProviderConfig(
        jwks_url="https://www.googleapis.com/oauth2/v3/certs",
        issuers=("https://accounts.google.com", "accounts.google.com"),
    ),
}


@dataclass(frozen=True)
class VerifiedIdentity:
    provider: Provider
    subject: str
    email: str | None
    email_verified: bool
    name: str | None


class InvalidIdToken(Exception):
    pass


class ProviderUnavailable(Exception):
    """Couldn't fetch the provider's signing keys. Not the user's fault; retry later."""


class IdTokenVerifier(Protocol):
    def verify(self, provider: Provider, token: str, nonce: str | None) -> VerifiedIdentity: ...


class SigningKeySource(Protocol):
    """What we need from jwt.PyJWKClient; swappable in tests."""

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK: ...


def _truthy(value: object) -> bool:
    # Apple sends booleans as strings ("true"); Google sends real booleans.
    return value is True or value == "true"


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class JwksIdTokenVerifier:
    def __init__(
        self,
        audiences: dict[Provider, list[str]],
        key_sources: dict[Provider, SigningKeySource] | None = None,
    ) -> None:
        self._audiences = audiences
        # PyJWKClient caches the key set and refetches on unknown key ids.
        self._keys: dict[Provider, SigningKeySource] = key_sources or {
            p: jwt.PyJWKClient(cfg.jwks_url, cache_keys=True, lifespan=3600)
            for p, cfg in PROVIDERS.items()
        }

    def verify(self, provider: Provider, token: str, nonce: str | None) -> VerifiedIdentity:
        audiences = self._audiences.get(provider) or []
        if not audiences:
            raise InvalidIdToken(f"{provider} sign-in is not configured on the server")
        try:
            signing_key = self._keys[provider].get_signing_key_from_jwt(token)
        except jwt.PyJWKClientConnectionError as exc:
            raise ProviderUnavailable(str(exc)) from exc
        except jwt.PyJWTError as exc:
            raise InvalidIdToken(str(exc)) from exc
        try:
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=audiences,
                issuer=PROVIDERS[provider].issuers,
                options={"require": ["iss", "aud", "sub", "exp", "iat"]},
                leeway=30,
            )
        except jwt.PyJWTError as exc:
            raise InvalidIdToken(str(exc)) from exc

        # Replay protection: the app passes sha256(nonce) to the provider and the
        # raw nonce to us. If either side used a nonce, both must match.
        claim_nonce = claims.get("nonce")
        if claim_nonce is not None or nonce is not None:
            if nonce is None or claim_nonce != sha256_hex(nonce):
                raise InvalidIdToken("nonce mismatch")

        return VerifiedIdentity(
            provider=provider,
            subject=str(claims["sub"]),
            email=claims.get("email"),
            email_verified=_truthy(claims.get("email_verified")),
            # Google includes the name; Apple never does (the app sends it on first sign-in).
            name=claims.get("name"),
        )


def build_verifier() -> JwksIdTokenVerifier:
    settings = get_settings()
    return JwksIdTokenVerifier(
        {"apple": settings.apple_audiences, "google": settings.google_audiences}
    )

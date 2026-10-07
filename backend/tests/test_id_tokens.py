"""The real ID token verifier, against tokens signed with a locally generated key."""

import time
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from app.id_tokens import (
    InvalidIdToken,
    JwksIdTokenVerifier,
    Provider,
    ProviderUnavailable,
    sha256_hex,
)

APPLE_AUD = "com.tvick.flexin"
GOOGLE_AUD = "1234-ios.apps.googleusercontent.com"


def make_key(kid: str) -> tuple[rsa.RSAPrivateKey, jwt.PyJWK]:
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = RSAAlgorithm.to_jwk(private.public_key(), as_dict=True)
    return private, jwt.PyJWK.from_dict({**jwk, "kid": kid, "alg": "RS256", "use": "sig"})


PROVIDER_KEY, PROVIDER_JWK = make_key("provider-key")
ATTACKER_KEY, _ = make_key("attacker-key")


class StaticKeys:
    """Plays the provider's JWKS endpoint: always returns the provider's public key."""

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        return PROVIDER_JWK


def verifier(google_aud: list[str] | None = None) -> JwksIdTokenVerifier:
    return JwksIdTokenVerifier(
        {"apple": [APPLE_AUD], "google": [GOOGLE_AUD] if google_aud is None else google_aud},
        key_sources={"apple": StaticKeys(), "google": StaticKeys()},
    )


def sign(claims: dict[str, Any], key: rsa.RSAPrivateKey = PROVIDER_KEY) -> str:
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "provider-key"})


def apple_claims(**overrides: Any) -> dict[str, Any]:
    now = int(time.time())
    claims = {
        "iss": "https://appleid.apple.com",
        "aud": APPLE_AUD,
        "sub": "001234.abcd",
        "iat": now,
        "exp": now + 600,
        "email": "x7k2@privaterelay.appleid.com",
        "email_verified": "true",  # Apple sends a string
    }
    claims.update(overrides)
    return {k: v for k, v in claims.items() if v is not None}


def google_claims(**overrides: Any) -> dict[str, Any]:
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com",
        "aud": GOOGLE_AUD,
        "sub": "1098765432",
        "iat": now,
        "exp": now + 600,
        "email": "maya@example.com",
        "email_verified": True,
        "name": "Maya Chen",
    }
    claims.update(overrides)
    return claims


def verify(provider: Provider, claims: dict, nonce: str | None = None, **kw: Any):
    return verifier(**kw).verify(provider, sign(claims), nonce)


def test_valid_apple_token() -> None:
    identity = verify("apple", apple_claims())
    assert identity.provider == "apple"
    assert identity.subject == "001234.abcd"
    assert identity.email == "x7k2@privaterelay.appleid.com"
    assert identity.email_verified is True
    assert identity.name is None


@pytest.mark.parametrize("issuer", ["https://accounts.google.com", "accounts.google.com"])
def test_valid_google_token_with_either_issuer(issuer: str) -> None:
    identity = verify("google", google_claims(iss=issuer))
    assert identity.subject == "1098765432"
    assert identity.email_verified is True
    assert identity.name == "Maya Chen"


@pytest.mark.parametrize(
    "claims",
    [
        apple_claims(aud="com.someone.else"),  # token minted for another app
        apple_claims(iss="https://evil.example.com"),
        apple_claims(exp=int(time.time()) - 3600),  # expired
        apple_claims(sub=None),  # missing subject
    ],
    ids=["wrong-audience", "wrong-issuer", "expired", "no-subject"],
)
def test_bad_claims_are_rejected(claims: dict) -> None:
    with pytest.raises(InvalidIdToken):
        verify("apple", claims)


def test_token_signed_by_someone_else_is_rejected() -> None:
    with pytest.raises(InvalidIdToken):
        verifier().verify("apple", sign(apple_claims(), key=ATTACKER_KEY), None)


def test_google_token_cannot_be_used_as_apple() -> None:
    with pytest.raises(InvalidIdToken):
        verify("apple", google_claims())


def test_unverified_email_is_reported() -> None:
    identity = verify("google", google_claims(email_verified=False))
    assert identity.email_verified is False


def test_matching_nonce_passes() -> None:
    verify("apple", apple_claims(nonce=sha256_hex("raw-nonce-123")), nonce="raw-nonce-123")


@pytest.mark.parametrize(
    ("claim_nonce", "sent_nonce"),
    [
        (sha256_hex("raw-nonce-123"), "different"),  # wrong nonce
        (sha256_hex("raw-nonce-123"), None),  # token has one, app didn't send it
        (None, "raw-nonce-123"),  # app sent one, token has none (replayed older token)
    ],
)
def test_nonce_mismatch_is_rejected(claim_nonce: str | None, sent_nonce: str | None) -> None:
    with pytest.raises(InvalidIdToken):
        verify("apple", apple_claims(nonce=claim_nonce), nonce=sent_nonce)


def test_unconfigured_provider_is_rejected() -> None:
    with pytest.raises(InvalidIdToken, match="not configured"):
        verify("google", google_claims(), google_aud=[])


class UnreachableKeys:
    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        raise jwt.PyJWKClientConnectionError("connection refused")


def test_unreachable_key_server_is_not_the_users_fault() -> None:
    v = JwksIdTokenVerifier({"apple": [APPLE_AUD]}, key_sources={"apple": UnreachableKeys()})
    with pytest.raises(ProviderUnavailable):
        v.verify("apple", sign(apple_claims()), None)

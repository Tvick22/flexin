"""End-to-end auth flows through the HTTP API (provider token checks faked)."""

import pytest
from httpx import AsyncClient

from tests.conftest import FakeVerifier

pytestmark = pytest.mark.anyio


def bearer(tokens: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def apple_sign_in(client: AsyncClient, verifier: FakeVerifier, **kwargs) -> dict:
    subject = kwargs.pop("subject", "001234.apple")
    names = {k: kwargs.pop(k) for k in ("givenName", "familyName") if k in kwargs}
    token = verifier.issue("apple", subject, **kwargs)
    response = await client.post("/auth/apple", json={"identityToken": token, **names})
    assert response.status_code == 200, response.text
    return response.json()


async def google_sign_in(client: AsyncClient, verifier: FakeVerifier, **kwargs) -> dict:
    subject = kwargs.pop("subject", "1098765432")
    token = verifier.issue("google", subject, **kwargs)
    response = await client.post("/auth/google", json={"idToken": token})
    assert response.status_code == 200, response.text
    return response.json()


# --- Sign-in -----------------------------------------------------------------


async def test_first_apple_sign_in_creates_account(
    client: AsyncClient, verifier: FakeVerifier
) -> None:
    body = await apple_sign_in(
        client, verifier, email="trev@example.com", givenName="Trevor", familyName="Vick"
    )

    assert body["isNewUser"] is True
    assert body["tokenType"] == "bearer"
    assert body["expiresIn"] == 15 * 60
    assert body["accessToken"] and body["refreshToken"]
    user = body["user"]
    assert user["name"] == "Trevor Vick"
    assert user["email"] == "trev@example.com"
    assert user["handle"] is None and user["onboarded"] is False
    assert user["unit"] == "lb"
    assert len(user["friendCode"]) == 8


async def test_signing_in_again_returns_same_account(
    client: AsyncClient, verifier: FakeVerifier
) -> None:
    first = await apple_sign_in(client, verifier)
    second = await apple_sign_in(client, verifier)
    assert second["isNewUser"] is False
    assert second["user"]["id"] == first["user"]["id"]


async def test_apple_without_name_or_email(client: AsyncClient, verifier: FakeVerifier) -> None:
    body = await apple_sign_in(client, verifier)
    assert body["user"]["name"] is None and body["user"]["email"] is None


async def test_rejected_provider_token_is_401(client: AsyncClient) -> None:
    response = await client.post("/auth/apple", json={"identityToken": "forged"})
    assert response.status_code == 401


async def test_google_with_same_verified_email_links_to_apple_account(
    client: AsyncClient, verifier: FakeVerifier
) -> None:
    apple = await apple_sign_in(client, verifier, email="trev@example.com")
    google = await google_sign_in(client, verifier, email="TREV@example.com", name="Trev")
    assert google["isNewUser"] is False
    assert google["user"]["id"] == apple["user"]["id"]


async def test_unverified_email_never_links(client: AsyncClient, verifier: FakeVerifier) -> None:
    apple = await apple_sign_in(client, verifier, email="trev@example.com")
    google = await google_sign_in(client, verifier, email="trev@example.com", email_verified=False)
    assert google["isNewUser"] is True
    assert google["user"]["id"] != apple["user"]["id"]
    assert google["user"]["email"] is None


async def test_google_name_is_used_for_new_account(
    client: AsyncClient, verifier: FakeVerifier
) -> None:
    body = await google_sign_in(client, verifier, email="maya@example.com", name="Maya Chen")
    assert body["user"]["name"] == "Maya Chen"


# --- /me and onboarding ------------------------------------------------------


async def test_me_requires_a_valid_access_token(
    client: AsyncClient, verifier: FakeVerifier
) -> None:
    assert (await client.get("/me")).status_code == 401
    garbage = await client.get("/me", headers={"Authorization": "Bearer nope"})
    assert garbage.status_code == 401

    tokens = await apple_sign_in(client, verifier)
    response = await client.get("/me", headers=bearer(tokens))
    assert response.status_code == 200
    assert response.json()["id"] == tokens["user"]["id"]


async def test_onboarding_sets_name_handle_and_unit(
    client: AsyncClient, verifier: FakeVerifier
) -> None:
    tokens = await apple_sign_in(client, verifier)
    response = await client.patch(
        "/me", headers=bearer(tokens), json={"name": " Trevor ", "handle": "@TVick", "unit": "kg"}
    )
    assert response.status_code == 200, response.text
    me = response.json()
    assert me["name"] == "Trevor"
    assert me["handle"] == "tvick"
    assert me["unit"] == "kg"
    assert me["onboarded"] is True


@pytest.mark.parametrize(
    "body", [{"handle": "no spaces"}, {"handle": "ab"}, {"name": "   "}, {"unit": "st"}]
)
async def test_invalid_profile_updates_are_422(
    client: AsyncClient, verifier: FakeVerifier, body: dict
) -> None:
    tokens = await apple_sign_in(client, verifier)
    response = await client.patch("/me", headers=bearer(tokens), json=body)
    assert response.status_code == 422


async def test_taken_handle_is_409(client: AsyncClient, verifier: FakeVerifier) -> None:
    trev = await apple_sign_in(client, verifier, subject="trev")
    maya = await apple_sign_in(client, verifier, subject="maya")
    await client.patch("/me", headers=bearer(trev), json={"handle": "lifts"})
    response = await client.patch("/me", headers=bearer(maya), json={"handle": "Lifts"})
    assert response.status_code == 409


async def test_handle_availability(client: AsyncClient, verifier: FakeVerifier) -> None:
    trev = await apple_sign_in(client, verifier, subject="trev")
    maya = await apple_sign_in(client, verifier, subject="maya")
    await client.patch("/me", headers=bearer(trev), json={"handle": "tvick"})

    async def check(tokens: dict, handle: str) -> dict:
        return (await client.get(f"/handles/{handle}", headers=bearer(tokens))).json()

    assert await check(maya, "TVick") == {"handle": "tvick", "available": False, "reason": "taken"}
    assert (await check(trev, "tvick"))["available"] is True  # your own handle
    assert (await check(maya, "mayalifts"))["available"] is True
    assert (await check(maya, "x"))["reason"] == "invalid"


# --- Sessions ----------------------------------------------------------------


async def test_refresh_rotates_tokens(client: AsyncClient, verifier: FakeVerifier) -> None:
    tokens = await apple_sign_in(client, verifier)
    response = await client.post("/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert response.status_code == 200
    rotated = response.json()
    assert rotated["refreshToken"] != tokens["refreshToken"]
    assert (await client.get("/me", headers=bearer(rotated))).status_code == 200


async def test_reusing_a_spent_refresh_token_ends_all_sessions(
    client: AsyncClient, verifier: FakeVerifier
) -> None:
    tokens = await apple_sign_in(client, verifier)
    rotated = (
        await client.post("/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    ).json()

    replay = await client.post("/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert replay.status_code == 401
    # The legitimate (rotated) session was revoked too, so a thief gains nothing.
    assert (await client.get("/me", headers=bearer(rotated))).status_code == 401
    again = await client.post("/auth/refresh", json={"refreshToken": rotated["refreshToken"]})
    assert again.status_code == 401


async def test_logout_ends_the_session(client: AsyncClient, verifier: FakeVerifier) -> None:
    tokens = await apple_sign_in(client, verifier)
    response = await client.post("/auth/logout", json={"refreshToken": tokens["refreshToken"]})
    assert response.status_code == 204

    assert (await client.get("/me", headers=bearer(tokens))).status_code == 401
    refresh = await client.post("/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert refresh.status_code == 401


async def test_logout_with_unknown_token_still_succeeds(client: AsyncClient) -> None:
    response = await client.post("/auth/logout", json={"refreshToken": "never-issued"})
    assert response.status_code == 204


async def test_signing_in_on_two_devices_keeps_separate_sessions(
    client: AsyncClient, verifier: FakeVerifier
) -> None:
    phone = await apple_sign_in(client, verifier)
    tablet = await apple_sign_in(client, verifier)
    await client.post("/auth/logout", json={"refreshToken": phone["refreshToken"]})
    assert (await client.get("/me", headers=bearer(tablet))).status_code == 200


async def test_dev_sign_in_creates_then_reuses_a_test_account(client: AsyncClient) -> None:
    first = (await client.post("/auth/dev", json={"email": "tester@flexin.local"})).json()
    again = (await client.post("/auth/dev", json={"email": "Tester@flexin.local"})).json()
    assert first["isNewUser"] is True and again["isNewUser"] is False
    assert first["user"]["id"] == again["user"]["id"]
    assert (await client.get("/me", headers=bearer(again))).status_code == 200

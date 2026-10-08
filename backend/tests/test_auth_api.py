"""End-to-end auth flows through the HTTP API."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio

PASSWORD = "deadlift-405"


def bearer(tokens: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def sign_up(client: AsyncClient, email: str = "trev@example.com", **kw) -> dict:
    response = await client.post(
        "/auth/signup", json={"email": email, "password": kw.get("password", PASSWORD)}
    )
    assert response.status_code == 201, response.text
    return response.json()


async def log_in(client: AsyncClient, email: str, password: str = PASSWORD):
    return await client.post("/auth/login", json={"email": email, "password": password})


# --- Sign-up and login -------------------------------------------------------


async def test_sign_up_creates_account_and_signs_in(client: AsyncClient) -> None:
    body = await sign_up(client)

    assert body["isNewUser"] is True
    assert body["tokenType"] == "bearer"
    assert body["expiresIn"] == 15 * 60
    assert body["accessToken"] and body["refreshToken"]
    user = body["user"]
    assert user["email"] == "trev@example.com"
    assert user["name"] is None and user["handle"] is None
    assert user["onboarded"] is False
    assert user["unit"] == "lb"
    assert len(user["friendCode"]) == 8
    assert "passwordHash" not in user and "password_hash" not in user


async def test_email_can_only_sign_up_once_ignoring_case(client: AsyncClient) -> None:
    await sign_up(client, "trev@example.com")
    response = await client.post(
        "/auth/signup", json={"email": "TREV@Example.com", "password": PASSWORD}
    )
    assert response.status_code == 409


@pytest.mark.parametrize(
    "body",
    [
        {"email": "not-an-email", "password": PASSWORD},
        {"email": "trev@example.com", "password": "short"},
        {"email": "trev@example.com", "password": "x" * 129},
    ],
    ids=["bad-email", "too-short", "too-long"],
)
async def test_sign_up_validation(client: AsyncClient, body: dict) -> None:
    assert (await client.post("/auth/signup", json=body)).status_code == 422


async def test_log_in_with_correct_password(client: AsyncClient) -> None:
    created = await sign_up(client, "trev@example.com")
    response = await log_in(client, "  Trev@Example.com ")
    assert response.status_code == 200
    body = response.json()
    assert body["isNewUser"] is False
    assert body["user"]["id"] == created["user"]["id"]


async def test_wrong_password_and_unknown_email_look_the_same(client: AsyncClient) -> None:
    await sign_up(client, "trev@example.com")
    wrong_password = await log_in(client, "trev@example.com", "not-my-password")
    unknown_email = await log_in(client, "nobody@example.com")
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


# --- /me and onboarding ------------------------------------------------------


async def test_me_requires_a_valid_access_token(client: AsyncClient) -> None:
    assert (await client.get("/me")).status_code == 401
    garbage = await client.get("/me", headers={"Authorization": "Bearer nope"})
    assert garbage.status_code == 401

    tokens = await sign_up(client)
    response = await client.get("/me", headers=bearer(tokens))
    assert response.status_code == 200
    assert response.json()["id"] == tokens["user"]["id"]


async def test_onboarding_sets_name_handle_and_unit(client: AsyncClient) -> None:
    tokens = await sign_up(client)
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
async def test_invalid_profile_updates_are_422(client: AsyncClient, body: dict) -> None:
    tokens = await sign_up(client)
    response = await client.patch("/me", headers=bearer(tokens), json=body)
    assert response.status_code == 422


async def test_taken_handle_is_409(client: AsyncClient) -> None:
    trev = await sign_up(client, "trev@example.com")
    maya = await sign_up(client, "maya@example.com")
    await client.patch("/me", headers=bearer(trev), json={"handle": "lifts"})
    response = await client.patch("/me", headers=bearer(maya), json={"handle": "Lifts"})
    assert response.status_code == 409


async def test_handle_availability(client: AsyncClient) -> None:
    trev = await sign_up(client, "trev@example.com")
    maya = await sign_up(client, "maya@example.com")
    await client.patch("/me", headers=bearer(trev), json={"handle": "tvick"})

    async def check(tokens: dict, handle: str) -> dict:
        return (await client.get(f"/handles/{handle}", headers=bearer(tokens))).json()

    assert await check(maya, "TVick") == {"handle": "tvick", "available": False, "reason": "taken"}
    assert (await check(trev, "tvick"))["available"] is True  # your own handle
    assert (await check(maya, "mayalifts"))["available"] is True
    assert (await check(maya, "x"))["reason"] == "invalid"


# --- Sessions ----------------------------------------------------------------


async def test_refresh_rotates_tokens(client: AsyncClient) -> None:
    tokens = await sign_up(client)
    response = await client.post("/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert response.status_code == 200
    rotated = response.json()
    assert rotated["refreshToken"] != tokens["refreshToken"]
    assert (await client.get("/me", headers=bearer(rotated))).status_code == 200


async def test_reusing_a_spent_refresh_token_ends_all_sessions(client: AsyncClient) -> None:
    tokens = await sign_up(client)
    rotated = (
        await client.post("/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    ).json()

    replay = await client.post("/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert replay.status_code == 401
    # The legitimate (rotated) session was revoked too, so a thief gains nothing.
    assert (await client.get("/me", headers=bearer(rotated))).status_code == 401
    again = await client.post("/auth/refresh", json={"refreshToken": rotated["refreshToken"]})
    assert again.status_code == 401


async def test_logout_ends_the_session(client: AsyncClient) -> None:
    tokens = await sign_up(client)
    response = await client.post("/auth/logout", json={"refreshToken": tokens["refreshToken"]})
    assert response.status_code == 204

    assert (await client.get("/me", headers=bearer(tokens))).status_code == 401
    refresh = await client.post("/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert refresh.status_code == 401


async def test_logout_with_unknown_token_still_succeeds(client: AsyncClient) -> None:
    response = await client.post("/auth/logout", json={"refreshToken": "never-issued"})
    assert response.status_code == 204


async def test_two_devices_keep_separate_sessions(client: AsyncClient) -> None:
    phone = await sign_up(client, "trev@example.com")
    tablet = (await log_in(client, "trev@example.com")).json()
    await client.post("/auth/logout", json={"refreshToken": phone["refreshToken"]})
    assert (await client.get("/me", headers=bearer(tablet))).status_code == 200

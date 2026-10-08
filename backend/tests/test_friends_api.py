"""Friend requests and friendships between real accounts, through the HTTP API."""

from dataclasses import dataclass

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


@dataclass
class Account:
    id: str
    handle: str
    friend_code: str
    headers: dict[str, str]


async def account(client: AsyncClient, handle: str, onboard: bool = True) -> Account:
    signup = await client.post(
        "/auth/signup", json={"email": f"{handle}@example.com", "password": "password-123"}
    )
    assert signup.status_code == 201, signup.text
    body = signup.json()
    headers = {"Authorization": f"Bearer {body['accessToken']}"}
    if onboard:
        response = await client.patch(
            "/me", headers=headers, json={"name": handle.title(), "handle": handle}
        )
        assert response.status_code == 200, response.text
    return Account(body["user"]["id"], handle, body["user"]["friendCode"], headers)


async def send(client: AsyncClient, sender: Account, code: str):
    return await client.post("/friends/requests", headers=sender.headers, json={"friendCode": code})


async def requests_of(client: AsyncClient, who: Account) -> list[dict]:
    response = await client.get("/friends/requests", headers=who.headers)
    assert response.status_code == 200
    return response.json()


async def friends_of(client: AsyncClient, who: Account) -> list[dict]:
    response = await client.get("/friends", headers=who.headers)
    assert response.status_code == 200
    return response.json()


async def test_full_flow_send_see_accept(client: AsyncClient) -> None:
    trev, maya = await account(client, "trev"), await account(client, "maya")

    sent = await send(client, trev, maya.friend_code)
    assert sent.status_code == 201
    request = sent.json()
    assert request["direction"] == "outgoing"
    assert request["user"] == {"id": maya.id, "name": "Maya", "handle": "maya", "avatarUrl": None}

    # Both sides see it, from their own point of view.
    assert [(r["id"], r["direction"]) for r in await requests_of(client, trev)] == [
        (request["id"], "outgoing")
    ]
    incoming = await requests_of(client, maya)
    assert incoming[0]["direction"] == "incoming"
    assert incoming[0]["user"]["handle"] == "trev"

    accepted = await client.post(f"/friends/requests/{request['id']}/accept", headers=maya.headers)
    assert accepted.status_code == 200
    assert accepted.json()["user"]["handle"] == "trev"

    # Friends on both sides; the request is gone for both.
    assert [f["user"]["handle"] for f in await friends_of(client, trev)] == ["maya"]
    assert [f["user"]["handle"] for f in await friends_of(client, maya)] == ["trev"]
    assert await requests_of(client, trev) == []
    assert await requests_of(client, maya) == []


async def test_code_is_forgiving_about_format(client: AsyncClient) -> None:
    trev, maya = await account(client, "trev"), await account(client, "maya")
    messy = f" {maya.friend_code[:4].lower()}-{maya.friend_code[4:].lower()} "
    assert (await send(client, trev, messy)).status_code == 201


async def test_unknown_code_is_404(client: AsyncClient) -> None:
    trev = await account(client, "trev")
    response = await send(client, trev, "ZZZZZZZZ")
    assert response.status_code == 404
    assert "No one has that friend code" in response.json()["detail"]


async def test_own_code_is_400(client: AsyncClient) -> None:
    trev = await account(client, "trev")
    assert (await send(client, trev, trev.friend_code)).status_code == 400


async def test_not_onboarded_users_cant_be_found(client: AsyncClient) -> None:
    trev = await account(client, "trev")
    fresh = await account(client, "fresh", onboard=False)
    assert (await send(client, trev, fresh.friend_code)).status_code == 404


async def test_not_onboarded_users_cant_use_friends(client: AsyncClient) -> None:
    fresh = await account(client, "fresh", onboard=False)
    response = await client.get("/friends", headers=fresh.headers)
    assert response.status_code == 403


async def test_duplicate_requests_are_409_with_helpful_messages(client: AsyncClient) -> None:
    trev, maya = await account(client, "trev"), await account(client, "maya")
    await send(client, trev, maya.friend_code)

    again = await send(client, trev, maya.friend_code)
    assert again.status_code == 409
    assert again.json()["detail"] == "You already sent Maya a request."

    reverse = await send(client, maya, trev.friend_code)
    assert reverse.status_code == 409
    assert reverse.json()["detail"] == "Trev already sent you a request. Accept it in Requests."


async def test_cant_request_an_existing_friend(client: AsyncClient) -> None:
    trev, maya = await account(client, "trev"), await account(client, "maya")
    request = (await send(client, trev, maya.friend_code)).json()
    await client.post(f"/friends/requests/{request['id']}/accept", headers=maya.headers)

    response = await send(client, maya, trev.friend_code)
    assert response.status_code == 409
    assert response.json()["detail"] == "You're already friends with Trev."


async def test_only_the_recipient_can_accept(client: AsyncClient) -> None:
    trev, maya = await account(client, "trev"), await account(client, "maya")
    request = (await send(client, trev, maya.friend_code)).json()
    response = await client.post(f"/friends/requests/{request['id']}/accept", headers=trev.headers)
    assert response.status_code == 404
    assert await friends_of(client, trev) == []


async def test_recipient_can_decline(client: AsyncClient) -> None:
    trev, maya = await account(client, "trev"), await account(client, "maya")
    request = (await send(client, trev, maya.friend_code)).json()
    response = await client.delete(f"/friends/requests/{request['id']}", headers=maya.headers)
    assert response.status_code == 204
    assert await requests_of(client, trev) == []
    assert await friends_of(client, maya) == []
    # Declining doesn't block asking again later.
    assert (await send(client, trev, maya.friend_code)).status_code == 201


async def test_sender_can_cancel(client: AsyncClient) -> None:
    trev, maya = await account(client, "trev"), await account(client, "maya")
    request = (await send(client, trev, maya.friend_code)).json()
    response = await client.delete(f"/friends/requests/{request['id']}", headers=trev.headers)
    assert response.status_code == 204
    assert await requests_of(client, maya) == []


async def test_outsiders_cant_touch_a_request(client: AsyncClient) -> None:
    trev, maya, sam = [await account(client, h) for h in ("trev", "maya", "sam")]
    request = (await send(client, trev, maya.friend_code)).json()
    deleted = await client.delete(f"/friends/requests/{request['id']}", headers=sam.headers)
    assert deleted.status_code == 404
    accepted = await client.post(f"/friends/requests/{request['id']}/accept", headers=sam.headers)
    assert accepted.status_code == 404
    assert len(await requests_of(client, maya)) == 1


async def test_unfriend(client: AsyncClient) -> None:
    trev, maya = await account(client, "trev"), await account(client, "maya")
    request = (await send(client, trev, maya.friend_code)).json()
    await client.post(f"/friends/requests/{request['id']}/accept", headers=maya.headers)

    response = await client.delete(f"/friends/{maya.id}", headers=trev.headers)
    assert response.status_code == 204
    assert await friends_of(client, trev) == []
    assert await friends_of(client, maya) == []
    again = await client.delete(f"/friends/{maya.id}", headers=trev.headers)
    assert again.status_code == 404


async def test_friends_and_requests_are_per_user(client: AsyncClient) -> None:
    trev, maya, sam = [await account(client, h) for h in ("trev", "maya", "sam")]
    await send(client, trev, maya.friend_code)
    assert await requests_of(client, sam) == []
    assert await friends_of(client, sam) == []

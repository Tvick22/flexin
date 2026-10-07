"""Request/response shapes. JSON is camelCase to match the app's TypeScript types."""

import re
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.models.user import HANDLE_PATTERN

WeightUnit = Literal["lb", "kg"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# --- Users -------------------------------------------------------------------


class MeRead(CamelModel):
    """GET /me. Matches the app's `Me` type, plus email and onboarding state."""

    id: uuid.UUID
    email: str | None
    name: str | None
    handle: str | None
    avatar_url: str | None
    weight_unit: WeightUnit = Field(serialization_alias="unit")
    friend_code: str
    # False until the user has picked a handle (and name) in onboarding.
    onboarded: bool


def normalize_handle(value: str) -> str:
    handle = value.strip().removeprefix("@").lower()
    if not re.fullmatch(HANDLE_PATTERN, handle):
        raise ValueError("Handles are 3–30 characters: letters, numbers and underscores.")
    return handle


class MeUpdate(CamelModel):
    """PATCH /me. Only the fields sent are changed."""

    name: str | None = Field(default=None, min_length=1, max_length=50)
    handle: str | None = None
    avatar_url: str | None = Field(default=None, max_length=2048)
    weight_unit: WeightUnit | None = Field(default=None, validation_alias="unit")

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Name can't be blank.")
        return value

    @field_validator("handle")
    @classmethod
    def _check_handle(cls, value: str | None) -> str | None:
        return None if value is None else normalize_handle(value)


class HandleAvailability(CamelModel):
    handle: str
    available: bool
    reason: Literal["taken", "invalid"] | None = None


# --- Auth --------------------------------------------------------------------


class AppleSignIn(CamelModel):
    identity_token: str
    # Raw nonce; the app passes sha256(nonce) to Apple. Optional but recommended.
    nonce: str | None = None
    # Apple only reveals the name on the first sign-in, and only to the app.
    given_name: str | None = Field(default=None, max_length=50)
    family_name: str | None = Field(default=None, max_length=50)


class GoogleSignIn(CamelModel):
    id_token: str
    nonce: str | None = None


class RefreshRequest(CamelModel):
    refresh_token: str


class TokenResponse(CamelModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    # Seconds until the access token expires; refresh before then.
    expires_in: int
    user: MeRead
    # True when this sign-in created the account: the app should show onboarding.
    is_new_user: bool = False

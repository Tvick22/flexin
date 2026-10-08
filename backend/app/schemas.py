"""Request/response shapes. JSON is camelCase to match the app's TypeScript types."""

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

from app.models.user import HANDLE_PATTERN
from app.passwords import MAX_LENGTH, MIN_LENGTH

WeightUnit = Literal["lb", "kg"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# --- Users -------------------------------------------------------------------


class MeRead(CamelModel):
    """GET /me. Matches the app's `Me` type, plus email and onboarding state."""

    id: uuid.UUID
    email: str
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


# --- Friends -----------------------------------------------------------------


class UserSummary(CamelModel):
    """Another user as you see them. Matches the app's `UserSummary`."""

    id: uuid.UUID
    name: str
    handle: str
    avatar_url: str | None


class FriendRead(CamelModel):
    user: UserSummary
    since: datetime


class FriendRequestRead(CamelModel):
    id: uuid.UUID
    direction: Literal["incoming", "outgoing"]
    user: UserSummary
    created_at: datetime


class SendFriendRequest(CamelModel):
    # Spaces, dashes and case are ignored ("7k2q-9mxp" works).
    friend_code: str = Field(max_length=20)


# --- Auth --------------------------------------------------------------------


class SignUp(CamelModel):
    email: EmailStr
    # Length is the only rule (NIST 800-63B): no forced symbols or digits.
    password: str = Field(min_length=MIN_LENGTH, max_length=MAX_LENGTH)


class LogIn(CamelModel):
    # Not validated as an email: a malformed one just fails like a wrong password.
    email: str = Field(max_length=320)
    password: str = Field(max_length=MAX_LENGTH)


class RefreshRequest(CamelModel):
    refresh_token: str


class TokenResponse(CamelModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    # Seconds until the access token expires; refresh before then.
    expires_in: int
    user: MeRead
    # True when this request created the account: the app should show onboarding.
    is_new_user: bool = False

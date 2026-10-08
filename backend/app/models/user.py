import uuid
from datetime import datetime
from typing import Literal

from sqlalchemy import CheckConstraint, DateTime, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.codes import FRIEND_CODE_PATTERN, generate_friend_code
from app.db import Base

WeightUnit = Literal["lb", "kg"]

HANDLE_PATTERN = r"^[a-z0-9_]{3,30}$"


class User(Base):
    """A Flexin' account. Mirrors the app's `Me` / `UserSummary` types (src/data/mock-data.ts).

    Created by signing up with email + password. Name and handle are collected
    in onboarding right after, so they start out null; `handle IS NULL` means
    not onboarded yet.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    # Sign-in identifier. Unique case-insensitively (see ix_users_email_lower below).
    email: Mapped[str] = mapped_column(String(320))
    # Argon2id hash (includes salt and parameters). Never the password itself.
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str | None] = mapped_column(String(50))
    # Lowercase, shown as @handle. Unique; format enforced by ck_users_handle_format.
    handle: Mapped[str | None] = mapped_column(String(30), unique=True)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    # Display preference only; weights are stored in kg everywhere else.
    weight_unit: Mapped[WeightUnit] = mapped_column(String(2), server_default="lb")
    friend_code: Mapped[str] = mapped_column(String(8), unique=True, default=generate_friend_code)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_users_email_lower", func.lower(email), unique=True),
        CheckConstraint(f"handle ~ '{HANDLE_PATTERN}'", name="handle_format"),
        CheckConstraint("weight_unit IN ('lb', 'kg')", name="weight_unit"),
        CheckConstraint(f"friend_code ~ '{FRIEND_CODE_PATTERN}'", name="friend_code_format"),
        CheckConstraint("length(trim(name)) > 0", name="name_not_blank"),
    )

    @property
    def onboarded(self) -> bool:
        """Picked a handle in onboarding (name is collected on the same screen)."""
        return self.handle is not None

    def __repr__(self) -> str:
        return f"<User {self.handle or '(not onboarded)'} {self.id}>"

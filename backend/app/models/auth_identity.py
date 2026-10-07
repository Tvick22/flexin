import uuid
from datetime import datetime
from typing import Literal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

AuthProvider = Literal["apple", "google"]


class AuthIdentity(Base):
    """A sign-in method linked to a user: one Apple and/or one Google account.

    Looked up by (provider, subject) on every sign-in. `subject` is the provider's
    stable user id: the `sub` claim of the verified ID token (Apple's `user`).
    Never look accounts up by email: Apple relay addresses differ per app and
    emails can change or be reassigned.
    """

    __tablename__ = "auth_identities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[AuthProvider] = mapped_column(String(16))
    subject: Mapped[str] = mapped_column(String(255))
    # Email the provider reported when linking; kept for support/debugging only.
    email: Mapped[str | None] = mapped_column(String(320))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        # One account per Apple/Google identity...
        UniqueConstraint("provider", "subject"),
        # ...and at most one Apple and one Google identity per account.
        UniqueConstraint("user_id", "provider"),
        CheckConstraint("provider IN ('apple', 'google')", name="provider"),
    )

    def __repr__(self) -> str:
        return f"<AuthIdentity {self.provider} user={self.user_id}>"

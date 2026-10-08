import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    PrimaryKeyConstraint,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class FriendRequest(Base):
    """A pending request from one user to another. Accepting turns it into a Friendship;
    declining or cancelling deletes it."""

    __tablename__ = "friend_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    from_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # One pending request per direction (the unique index also serves "my sent requests").
        UniqueConstraint("from_user_id", "to_user_id"),
        CheckConstraint("from_user_id <> to_user_id", name="not_self"),
    )


class Friendship(Base):
    """Two users who are friends. Stored once per pair, ids in sorted order, so a pair
    can't be duplicated and "are A and B friends?" is a single primary-key lookup."""

    __tablename__ = "friendships"

    user_low_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    user_high_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        PrimaryKeyConstraint("user_low_id", "user_high_id"),
        CheckConstraint("user_low_id < user_high_id", name="ordered_pair"),
    )

    @staticmethod
    def pair(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
        return (a, b) if a < b else (b, a)

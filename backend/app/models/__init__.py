"""ORM models. Import each model module here so Alembic autogenerate can find it.

Planned next (see src/data/mock-data.ts in the app for the shapes):
friendships, friend_requests, challenges,
challenge_participants, challenge_sets.
"""

from app.db import Base
from app.models.auth_session import AuthSession
from app.models.user import User

__all__ = ["AuthSession", "Base", "User"]

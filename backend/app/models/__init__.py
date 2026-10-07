"""ORM models. Import each model module here so Alembic autogenerate can find it.

None yet. Planned (see src/data/mock-data.ts in the app for the shapes):
users, friendships, friend_requests, challenges, challenge_participants,
challenge_sets.
"""

from app.db import Base

__all__ = ["Base"]

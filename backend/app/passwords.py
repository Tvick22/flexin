"""Password hashing with Argon2id (argon2-cffi's defaults follow RFC 9106)."""

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()

# Verified against when the email doesn't exist, so a login attempt takes the same
# time either way and can't be used to discover which emails have accounts.
_DUMMY_HASH = _hasher.hash("flexin-timing-equalizer")

MIN_LENGTH = 8
MAX_LENGTH = 128


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """True when the hash was made with older parameters; re-hash on next login."""
    return _hasher.check_needs_rehash(password_hash)

"""Shareable codes. Must match the app's src/utils/friend-code.ts."""

import re
import secrets

# No 0/O or 1/I/L, so codes survive being read aloud or typed from a screenshot.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
FRIEND_CODE_LENGTH = 8

# Same set as CODE_ALPHABET, as a regex character class (also used in the DB check).
CODE_CHAR_CLASS = "[A-HJKMNP-Z2-9]"
FRIEND_CODE_PATTERN = rf"^{CODE_CHAR_CLASS}{{{FRIEND_CODE_LENGTH}}}$"


def generate_friend_code() -> str:
    """Random friend code. ~8.5e11 possibilities; the unique index catches the rare clash."""
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(FRIEND_CODE_LENGTH))


def is_valid_friend_code(code: str) -> bool:
    return re.fullmatch(FRIEND_CODE_PATTERN, code) is not None

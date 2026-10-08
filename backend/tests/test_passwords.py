from app.passwords import hash_password, needs_rehash, verify_password


def test_hash_verifies_and_is_salted() -> None:
    a, b = hash_password("squat-day-123"), hash_password("squat-day-123")
    assert a != b  # random salt per hash
    assert a.startswith("$argon2id$")
    assert verify_password(a, "squat-day-123")
    assert not verify_password(a, "squat-day-124")
    assert not needs_rehash(a)


def test_missing_or_garbage_hash_never_verifies() -> None:
    assert not verify_password(None, "anything")
    assert not verify_password("not-a-hash", "anything")

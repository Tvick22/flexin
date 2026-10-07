import pytest
from pydantic import ValidationError

from app.config import DEV_JWT_SECRET, Settings


def test_production_refuses_the_dev_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(environment="production", jwt_secret=DEV_JWT_SECRET)


def test_production_with_a_real_secret_is_fine() -> None:
    Settings(environment="production", jwt_secret="x" * 48)


def test_dev_sign_in_only_exists_in_development() -> None:
    import subprocess
    import sys

    probe = "from app.main import app; print('/auth/dev' in app.openapi()['paths'])"
    env = {"ENVIRONMENT": "production", "JWT_SECRET": "x" * 48, "PATH": ""}
    result = subprocess.run(
        [sys.executable, "-c", probe], capture_output=True, text=True, env=env, check=True
    )
    assert result.stdout.strip() == "False"

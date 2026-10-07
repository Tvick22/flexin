import pytest
from pydantic import ValidationError

from app.config import DEV_JWT_SECRET, Settings


def test_production_refuses_the_dev_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(environment="production", jwt_secret=DEV_JWT_SECRET)


def test_production_with_a_real_secret_is_fine() -> None:
    Settings(environment="production", jwt_secret="x" * 48)

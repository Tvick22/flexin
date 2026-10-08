from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-insecure-secret-change-me"


def _split(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


class Settings(BaseSettings):
    """Configuration from environment variables (and backend/.env in development)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "production"] = "development"
    database_url: str = "postgresql+asyncpg://flexin:flexin@localhost:5432/flexin"
    cors_origins: str = "http://localhost:8081"

    # Signs our access tokens. Any long random string; MUST be overridden outside dev.
    jwt_secret: str = Field(default=DEV_JWT_SECRET, min_length=32)
    access_token_minutes: int = 15
    refresh_token_days: int = 60

    @model_validator(mode="after")
    def _no_dev_secret_in_production(self) -> "Settings":
        if self.environment == "production" and self.jwt_secret == DEV_JWT_SECRET:
            raise ValueError("Set JWT_SECRET: the development default can't be used in production.")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return _split(self.cors_origins)


@lru_cache
def get_settings() -> Settings:
    return Settings()

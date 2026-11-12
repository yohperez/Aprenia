from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
DEV_PEPPER = "development-only-pepper-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="YARA_", env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite:///./yara.db"
    content_dir: Path = REPO_ROOT / "content"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    trust_proxy_headers: bool = False

    recovery_pepper: str = DEV_PEPPER
    session_days: int = 365
    recover_limit: int = 10
    recover_window_seconds: int = 900
    guest_limit: int = 30
    guest_window_seconds: int = 3600

    tutor_enabled: bool = True
    tutor_provider: Literal["anthropic", "gemini", "fake", "none"] = "none"
    anthropic_api_key: str | None = None
    tutor_model: str = "claude-haiku-5-5"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    tutor_timeout_seconds: float = 15.0
    tutor_preset_daily_limit: int = 40
    tutor_text_daily_limit: int = 20
    tutor_event_retention_days: int = 30

    azure_speech_key: str | None = None
    azure_speech_region: str | None = None
    web_dir: Path | None = None

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @model_validator(mode="after")
    def require_secrets_in_production(self) -> "Settings":
        if self.environment == "production" and (
            self.recovery_pepper == DEV_PEPPER or len(self.recovery_pepper) < 32
        ):
            raise ValueError("YARA_RECOVERY_PEPPER must be a random value of at least 32 characters")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

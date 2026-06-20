from pydantic_settings import BaseSettings, SettingsConfigDict

from src.constants import Environment


class Config(BaseSettings):
    debug: bool = True
    database_url: str = ""

    cors_origins: list[str] = []
    cors_headers: list[str] = ["*"]

    env: Environment = Environment.DEV

    # JWT
    jwt_secret_key: str = "secret"
    jwt_refresh_secret_key: str | None = None

    # Google OAuth
    google_client_id: str = "id"
    google_client_secret: str = "secret"
    google_redirect_uri: str = "does.not.resolve"

    access_token_expire_minutes: int = 30
    jwt_algorithm: str = "HS256"

    upload_dir: str = "uploads"
    max_upload_size_bytes: int = 50 * 1024 * 1024

    model_config = SettingsConfigDict(env_prefix="pz_", extra="ignore")


config = Config()

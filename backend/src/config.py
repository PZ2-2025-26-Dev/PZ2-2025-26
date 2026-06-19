from pydantic_settings import BaseSettings, SettingsConfigDict

from src.constants import Environment


class Config(BaseSettings):
    debug: bool = True
    database_url: str = ""

    cors_origins: list[str] = []
    cors_headers: list[str] = ["*"]

    env: Environment = Environment.DEV

    # JWT
    jwt_secret_key: str
    jwt_refresh_secret_key: str | None = None

    # Google OAuth
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str

    access_token_expire_minutes: int = 30
    jwt_algorithm: str = "HS256"

    model_config = SettingsConfigDict(
        env_prefix="pz_",
        env_file=(".env","../.env", "backend/.env"),
        extra="ignore",
    )


config = Config()

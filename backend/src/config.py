from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from src.constants import Environment


class Config(BaseSettings):
    debug: bool = True
    database_url: str = Field(..., env="DATABASE_URL")

    # Konfiguracja CORS dla FastAPI.
    cors_origins: list[str] = []
    cors_headers: list[str] = ["*"]

    env: Environment = Environment.DEV

    jwt_secret_key: str = Field(..., env="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", env="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(30, env="ACCESS_TOKEN_EXPIRE_MINUTES")

    google_client_id: str = Field(..., env="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(..., env="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(..., env="GOOGLE_REDIRECT_URI")

    model_config = SettingsConfigDict(
        # env_prefix="pz_",
        env_file=".env",
        extra="ignore",
    )


settings = Config()
config = settings

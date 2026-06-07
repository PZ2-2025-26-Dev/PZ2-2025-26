from pydantic_settings import BaseSettings, SettingsConfigDict
from src.constants import Environment


class Config(BaseSettings):
    debug: bool = True
    database_url: str = ""
    jwt_secret: str = "dev-jwt-secret"
    jwt_algorithm: str = "HS256"

    # Konfiguracja CORS dla FastAPI.
    cors_origins: list[str] = []
    cors_headers: list[str] = ["*"]

    env: Environment = Environment.DEV

    model_config = SettingsConfigDict(env_prefix="pz_", env_file=(".env", "backend/.env"), extra="ignore")


config = Config()

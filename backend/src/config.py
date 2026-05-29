from pydantic_settings import BaseSettings, SettingsConfigDict

from src.constants import Environment


class Config(BaseSettings):
    debug: bool = True
    database_url: str = ""

    env: Environment = Environment.DEV

    model_config = SettingsConfigDict(env_prefix="pz_")


config = Config()

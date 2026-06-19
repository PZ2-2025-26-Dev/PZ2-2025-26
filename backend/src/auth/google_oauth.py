from authlib.integrations.starlette_client import OAuth

from src.config import config

oauth = OAuth()

oauth.register(
    name="google",
    client_id=config.google_client_id,
    client_secret=config.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)
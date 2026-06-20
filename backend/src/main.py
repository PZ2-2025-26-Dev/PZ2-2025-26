from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

# WORKAROUND:
# W trakcie projektu przerzucimy się na alembic
# póki co musimy importować modele SQLALchemy explicite.
# Inaczej nie są podlinkowane do toplevel Base
# i nie są automatycznie tworzone
from src.auth import models as auth_models  # noqa: F401
from src.auth.router import router as auth_router
from src.categories import models as categories_models  # noqa: F401
from src.categories.router import router as categories_router
from src.config import config
from src.database import Base, engine
from src.guests import models as guests_models  # noqa: F401
from src.items import models as items_models  # noqa: F401
from src.items.router import router as items_router
from src.loans import models as loans_models  # noqa: F401
from src.locations import models as locations_models  # noqa: F401
from src.locations.router import router as locations_router
from src.users import models as users_models  # noqa: F401
from src.users.router import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    yield


app = FastAPI(version="0.1.0", lifespan=lifespan)

# Konfiguracja CORS dla FastAPI.
# Originy i nagłówki są trzymane w settings/env
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=config.cors_headers,
)

app.add_middleware(
    SessionMiddleware,
    secret_key=config.jwt_secret_key,
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(items_router)
app.include_router(locations_router)
app.include_router(categories_router)


@app.get("/ready")
def ready() -> bool:
    return True

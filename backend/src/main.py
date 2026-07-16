import logging
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

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
from src.database import Base, SessionLocal, engine
from src.exports.router import router as exports_router

# from src.guests import models as guests_models  # noqa: F401
from src.items import models as items_models  # noqa: F401
from src.items.router import router as items_router
from src.loans import models as loans_models  # noqa: F401
from src.loans.constants import OVERDUE_SWEEP_INTERVAL_SECONDS
from src.loans.router import router as loans_router
from src.loans.service import mark_overdue_items
from src.locations import models as locations_models  # noqa: F401
from src.locations.router import router as locations_router
from src.users import models as users_models  # noqa: F401
from src.users.router import router as users_router


def _overdue_sweep_loop() -> None:
    while True:
        try:
            with SessionLocal() as db:
                mark_overdue_items(db)
        except Exception:
            logging.exception("Failed to update status of items with overdue loan")
        time.sleep(OVERDUE_SWEEP_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    upload_root = Path(config.upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)

    threading.Thread(target=_overdue_sweep_loop, daemon=True, name="overdue-sweep").start()

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
app.include_router(loans_router)
app.include_router(locations_router)
app.include_router(categories_router)
app.include_router(exports_router)


@app.get("/ready")
def ready() -> bool:
    return True

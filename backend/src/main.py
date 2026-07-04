from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
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
from src.exports.router import router as exports_router

# from src.guests import models as guests_models  # noqa: F401
from src.items import models as items_models  # noqa: F401
from src.items.router import router as items_router
from src.loans import models as loans_models  # noqa: F401
from src.loans.router import router as loans_router
from src.locations import models as locations_models  # noqa: F401
from src.locations.router import router as locations_router
from src.users import models as users_models  # noqa: F401
from src.users.router import router as users_router


def ensure_user_preferences_columns() -> None:
    columns = {
        "ui_theme": ("VARCHAR(16)", "light"),
        "ui_font": ("VARCHAR(16)", "sans"),
        "ui_accent": ("VARCHAR(32)", "agh-green"),
    }

    with engine.begin() as connection:
        existing_columns = {column["name"] for column in inspect(connection).get_columns("user")}
        quoted_user_table = connection.dialect.identifier_preparer.quote("user")

        for name, (column_type, default) in columns.items():
            if name in existing_columns:
                continue
            quoted_name = connection.dialect.identifier_preparer.quote(name)
            connection.execute(
                text(
                    f"ALTER TABLE {quoted_user_table} "
                    f"ADD COLUMN {quoted_name} {column_type} NOT NULL DEFAULT '{default}'"
                )
            )


def ensure_loan_columns() -> None:
    nullable_columns = {
        "note": "TEXT",
        "return_reported_by": "INT",
        "return_reported_at": "DATETIME",
        "return_note": "TEXT",
        "return_confirmed_by": "INT",
        "return_confirmed_at": "DATETIME",
        "return_confirmation_note": "TEXT",
    }

    with engine.begin() as connection:
        inspector = inspect(connection)
        table_names = inspector.get_table_names()
        if "loan" not in table_names:
            return

        existing_columns = {column["name"] for column in inspector.get_columns("loan")}
        quoted_loan_table = connection.dialect.identifier_preparer.quote("loan")

        for name, column_type in nullable_columns.items():
            if name in existing_columns:
                continue
            quoted_name = connection.dialect.identifier_preparer.quote(name)
            connection.execute(text(f"ALTER TABLE {quoted_loan_table} ADD COLUMN {quoted_name} {column_type} NULL"))

        if "return_condition" not in existing_columns:
            connection.execute(
                text(
                    f"ALTER TABLE {quoted_loan_table} "
                    "ADD COLUMN return_condition ENUM('OK','BROKEN','MISSING') NULL"
                    if connection.dialect.name == "mysql"
                    else f"ALTER TABLE {quoted_loan_table} ADD COLUMN return_condition VARCHAR(16) NULL"
                )
            )

        if "loan_purpose" in existing_columns:
            connection.execute(text(f"UPDATE {quoted_loan_table} SET note = loan_purpose WHERE note IS NULL"))

        if connection.dialect.name == "mysql":
            connection.execute(
                text(
                    f"ALTER TABLE {quoted_loan_table} MODIFY COLUMN status "
                    "ENUM('PENDING','APPROVED','DENIED','LOANED','RETURNED',"
                    "'PENDING_APPROVAL','ACTIVE','RETURN_PENDING_CONFIRMATION','CLOSED','REJECTED') NOT NULL"
                )
            )
            connection.execute(
                text(
                    f"UPDATE {quoted_loan_table} SET status = CASE status "
                    "WHEN 'PENDING' THEN 'PENDING_APPROVAL' "
                    "WHEN 'APPROVED' THEN 'ACTIVE' "
                    "WHEN 'LOANED' THEN 'ACTIVE' "
                    "WHEN 'DENIED' THEN 'REJECTED' "
                    "WHEN 'RETURNED' THEN 'CLOSED' "
                    "ELSE status END"
                )
            )
            connection.execute(
                text(
                    f"ALTER TABLE {quoted_loan_table} MODIFY COLUMN status "
                    "ENUM('PENDING_APPROVAL','ACTIVE','RETURN_PENDING_CONFIRMATION','CLOSED','REJECTED') NOT NULL"
                )
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_user_preferences_columns()
    ensure_loan_columns()

    upload_root = Path(config.upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)

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

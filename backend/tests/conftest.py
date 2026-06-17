from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.config import config
from src.constants import Environment
from src.database import Base, engine, get_db
from src.main import app
from src.seed import seed_database


@pytest.fixture(scope="session", autouse=True)
def test_database_schema() -> Iterator[None]:
    if config.env == Environment.PROD:
        raise RuntimeError("Integration tests cannot recreate the schema when PZ_ENV=prod.")

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db(test_database_schema: None) -> Iterator[Session]:
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def seeded_db(db: Session) -> Session:
    seed_database(db)
    return db


@pytest.fixture()
def api_client(db: Session) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        yield db

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override

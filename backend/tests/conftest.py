<<<<<<< HEAD
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from src.config import config
from src.database import Base, get_db
=======
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.config import config
from src.constants import Environment
from src.database import Base, engine, get_db
>>>>>>> origin/main
from src.main import app
from src.seed import seed_database

# używamy tej samej bazy co aplikacja (MySQL)
SQLALCHEMY_DATABASE_URL = config.database_url

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
)

TestingSessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    # tworzy wszystkie tabele z modeli SQLAlchemy
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


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
<<<<<<< HEAD
def client(db):
    def override_get_db() -> Generator:
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
=======
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
>>>>>>> origin/main

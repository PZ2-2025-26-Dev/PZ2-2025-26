<<<<<<< HEAD
import pytest

from src.database import SessionLocal
=======
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.database import Base, get_db
from src.main import app
from src.config import config

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
>>>>>>> 56f953c (task 30-us-r05 backend + frontend)


@pytest.fixture()
def db():
<<<<<<< HEAD
    # DISCUSS:
    # możemy dodać rollback po każdym testcase
    # ale to wymaga, żeby w klasach Service nie używać db.commit()
    with SessionLocal() as session:
        yield session
=======
    connection = engine.connect()
    transaction = connection.begin()

    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
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
>>>>>>> 56f953c (task 30-us-r05 backend + frontend)

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user
from src.config import config
from src.constants import Environment
from src.database import Base, engine, get_db
from src.main import app
from src.seed import SEED_IDS, seed_database
from src.users.models import User


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


def _client_authenticated_as(db: Session, user_id: int) -> Iterator[TestClient]:
    """Yield a TestClient whose requests are authenticated as the given user.

    Pomija realny przepływ JWT, podmieniając zależność get_current_user,
    aby testy routerów chronionych autoryzacją mogły działać na seedowych kontach.
    """

    def override_get_db() -> Iterator[Session]:
        yield db

    def override_get_current_user() -> User:
        return db.get(User, user_id)

    previous_db = app.dependency_overrides.get(get_db)
    previous_user = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with TestClient(app) as client:
            yield client
    finally:
        for dependency, previous in (
            (get_db, previous_db),
            (get_current_user, previous_user),
        ):
            if previous is None:
                app.dependency_overrides.pop(dependency, None)
            else:
                app.dependency_overrides[dependency] = previous


@pytest.fixture()
def admin_client(seeded_db: Session) -> Iterator[TestClient]:
    yield from _client_authenticated_as(seeded_db, SEED_IDS.admin_user)


@pytest.fixture()
def user_client(seeded_db: Session) -> Iterator[TestClient]:
    yield from _client_authenticated_as(seeded_db, SEED_IDS.regular_user)


@pytest.fixture()
def observer_client(seeded_db: Session) -> Iterator[TestClient]:
    yield from _client_authenticated_as(seeded_db, SEED_IDS.observer_user)

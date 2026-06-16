import pytest
from sqlalchemy.orm import Session

from src.database import engine
from src.seed import seed_database


@pytest.fixture()
def db():
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

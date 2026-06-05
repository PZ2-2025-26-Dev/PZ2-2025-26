import pytest

from src.database import SessionLocal


@pytest.fixture()
def db():
    # DISCUSS:
    # możemy dodać rollback po każdym testcase
    # ale to wymaga, żeby w klasach Service nie używać db.commit()
    with SessionLocal() as session:
        yield session

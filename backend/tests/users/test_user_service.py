from collections.abc import Iterator

import pytest
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.database import Base, engine
from src.users.models import User
from src.users.service import UserService


@pytest.fixture(autouse=True)
def user_tables() -> Iterator[None]:
    Base.metadata.create_all(bind=engine, tables=[User.__table__])
    yield
    Base.metadata.drop_all(bind=engine, tables=[User.__table__])


def add_users(db: Session) -> None:
    db.add_all(
        [
            User(
                first_name="Anna",
                last_name="Admin",
                email="anna.admin@example.com",
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
            ),
            User(
                first_name="Jan",
                last_name="Kowalski",
                email="jan.kowalski@example.com",
                role=UserRole.USER,
                status=UserStatus.PENDING_APPROVAL,
            ),
            User(
                first_name="Olga",
                last_name="Observer",
                email="olga.observer@example.com",
                role=UserRole.OBSERVER,
                status=UserStatus.INACTIVE,
            ),
        ]
    )
    db.commit()


def test_list_users_filters_by_role(db: Session):
    add_users(db)

    users, total_count = UserService(db).list_users(page=1, limit=20, role=UserRole.ADMIN)

    assert total_count == 1
    assert users[0].email == "anna.admin@example.com"


def test_list_users_filters_by_status(db: Session):
    add_users(db)

    users, total_count = UserService(db).list_users(page=1, limit=20, status=UserStatus.INACTIVE)

    assert total_count == 1
    assert users[0].email == "olga.observer@example.com"


def test_list_users_searches_name_and_email(db: Session):
    add_users(db)

    users_by_last_name, total_by_last_name = UserService(db).list_users(page=1, limit=20, search="kowal")
    users_by_email, total_by_email = UserService(db).list_users(page=1, limit=20, search="observer@example")

    assert total_by_last_name == 1
    assert users_by_last_name[0].email == "jan.kowalski@example.com"
    assert total_by_email == 1
    assert users_by_email[0].email == "olga.observer@example.com"

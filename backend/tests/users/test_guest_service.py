from uuid import uuid4

import pytest
from fastapi import HTTPException

from src.auth.constants import UserRole, UserStatus
from src.users.models import User
from src.users.schemas import GuestUserCreate, GuestUserUpdate
from src.users.service import GuestUserNotFoundError, UserEmailTakenError, UserService

pytestmark = pytest.mark.unit


def test_create_guest_user_without_email(db):
    guest = UserService(db).create_guest_user(
        GuestUserCreate(first_name="Jan", last_name="Kowalski"),
    )

    assert guest.role == UserRole.GUEST
    assert guest.status == UserStatus.ACTIVE
    assert guest.email is None


def test_create_guest_user_rejects_duplicate_email(db):
    email = f"guest_{uuid4()}@example.com"
    service = UserService(db)

    service.create_guest_user(GuestUserCreate(first_name="A", email=email))

    with pytest.raises(UserEmailTakenError):
        service.create_guest_user(GuestUserCreate(first_name="B", email=email))


def test_update_guest_user(db):
    service = UserService(db)
    guest = service.create_guest_user(GuestUserCreate(first_name="Jan", last_name="Kowalski"))

    updated = service.update_guest_user(
        guest.id,
        GuestUserUpdate(first_name="Janusz", email="janusz@example.com"),
    )

    assert updated.first_name == "Janusz"
    assert updated.email == "janusz@example.com"


def test_update_non_guest_raises(db):
    user = User(
        first_name="Admin",
        last_name="User",
        email=f"admin_{uuid4()}@example.com",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()

    with pytest.raises(GuestUserNotFoundError):
        UserService(db).update_guest_user(user.id, GuestUserUpdate(first_name="X"))


def test_list_browse_users_masks_regular_user_details(db):
    user = User(
        first_name="VisibleUnique",
        last_name="Name",
        email=f"visible_{uuid4()}@example.com",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()

    users, total = UserService(db).list_browse_users(page=1, limit=100, search="VisibleUnique")

    assert total >= 1
    matched = next(item for item in users if item.first_name == "VisibleUnique")
    assert not hasattr(matched, "id")
    assert matched.last_name == "Name"


def test_guest_cannot_login(db):
    from src.auth.service import login_user

    email = f"guest_login_{uuid4()}@example.com"
    UserService(db).create_guest_user(GuestUserCreate(first_name="Gość", email=email))

    with pytest.raises(HTTPException) as exc:
        login_user(db=db, email=email, password="Password123!")

    assert exc.value.status_code in {401, 403}

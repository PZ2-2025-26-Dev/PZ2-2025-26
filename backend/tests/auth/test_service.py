import pytest

from fastapi import HTTPException

from src.auth.constants import (
    UserRole,
    UserStatus,
    AuthProvider,
)

from src.auth.models import UserAccount
from src.auth.service import (
    register_user,
    login_user,
    get_or_create_google_user,
)

from src.users.models import User

def test_register_user_success(db):
    user = register_user(
        db=db,
        email="john@example.com",
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    assert user.email == "john@example.com"
    assert user.role == UserRole.USER
    assert user.status == UserStatus.PENDING_APPROVAL

    account = (
        db.query(UserAccount)
        .filter(UserAccount.user_id == user.id)
        .first()
    )

    assert account is not None
    assert account.provider == AuthProvider.LOCAL

def test_register_user_existing_email(db):
    register_user(
        db=db,
        email="john@example.com",
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    with pytest.raises(HTTPException) as exc:
        register_user(
            db=db,
            email="john@example.com",
            password="Password123!",
            first_name="John",
            last_name="Doe",
        )

    assert exc.value.status_code == 400

def test_register_user_existing_email(db):
    register_user(
        db=db,
        email="john@example.com",
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    with pytest.raises(HTTPException) as exc:
        register_user(
            db=db,
            email="john@example.com",
            password="Password123!",
            first_name="John",
            last_name="Doe",
        )

    assert exc.value.status_code == 400

def test_login_user_success(db):
    created = register_user(
        db=db,
        email="john@example.com",
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    created.status = UserStatus.ACTIVE
    db.commit()

    user = login_user(
        db=db,
        email="john@example.com",
        password="Password123!",
    )

    assert user.id == created.id

def test_login_wrong_email(db):
    with pytest.raises(HTTPException) as exc:
        login_user(
            db=db,
            email="missing@example.com",
            password="Password123!",
        )

    assert exc.value.status_code == 401


def test_login_wrong_password(db):
    created = register_user(
        db=db,
        email="john@example.com",
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    created.status = UserStatus.ACTIVE
    db.commit()

    with pytest.raises(HTTPException) as exc:
        login_user(
            db=db,
            email="john@example.com",
            password="wrong",
        )

    assert exc.value.status_code == 401

def test_login_not_active(db):
    register_user(
        db=db,
        email="john@example.com",
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    with pytest.raises(HTTPException) as exc:
        login_user(
            db=db,
            email="john@example.com",
            password="Password123!",
        )

    assert exc.value.status_code == 403


def test_google_user_created(db):
    user = get_or_create_google_user(
        db=db,
        email="google@example.com",
        google_id="google-123",
        first_name="John",
        last_name="Doe",
    )

    assert user.email == "google@example.com"
    assert user.status == UserStatus.ACTIVE

    account = (
        db.query(UserAccount)
        .filter(UserAccount.user_id == user.id)
        .first()
    )

    assert account.provider == AuthProvider.GOOGLE

def test_google_user_not_duplicated(db):
    user1 = get_or_create_google_user(
        db=db,
        email="google@example.com",
        google_id="123",
        first_name="John",
        last_name="Doe",
    )

    user2 = get_or_create_google_user(
        db=db,
        email="google@example.com",
        google_id="123",
        first_name="John",
        last_name="Doe",
    )

    assert user1.id == user2.id


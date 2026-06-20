from uuid import uuid4

import pytest
from fastapi import HTTPException

from src.auth.constants import AuthProvider, UserRole, UserStatus
from src.auth.models import UserAccount
from src.auth.service import (
    get_or_create_google_user,
    login_user,
    register_user,
)

pytestmark = pytest.mark.integration


def unique_email(prefix: str = "user") -> str:
    return f"{prefix}_{uuid4()}@example.com"


def test_register_user_success(db):
    email = unique_email("john")

    user = register_user(
        db=db,
        email=email,
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    assert user.email == email
    assert user.role == UserRole.USER
    assert user.status == UserStatus.PENDING_APPROVAL

    account = db.query(UserAccount).filter(UserAccount.user_id == user.id).first()

    assert account is not None
    assert account.provider == AuthProvider.LOCAL


def test_register_user_existing_email(db):
    email = unique_email("john")

    register_user(
        db=db,
        email=email,
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    with pytest.raises(HTTPException) as exc:
        register_user(
            db=db,
            email=email,
            password="Password123!",
            first_name="John",
            last_name="Doe",
        )

    assert exc.value.status_code == 409


def test_login_user_success(db):
    email = unique_email("login")

    created = register_user(
        db=db,
        email=email,
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    created.status = UserStatus.ACTIVE
    db.flush()
    db.refresh(created)

    user = login_user(
        db=db,
        email=email,
        password="Password123!",
    )

    assert user.id == created.id


def test_login_wrong_email(db):
    with pytest.raises(HTTPException) as exc:
        login_user(
            db=db,
            email=unique_email("missing"),
            password="Password123!",
        )

    assert exc.value.status_code == 401


def test_login_wrong_password(db):
    email = unique_email("login")

    created = register_user(
        db=db,
        email=email,
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    created.status = UserStatus.ACTIVE
    db.flush()
    db.refresh(created)

    with pytest.raises(HTTPException) as exc:
        login_user(
            db=db,
            email=email,
            password="wrong",
        )

    assert exc.value.status_code == 401


def test_login_not_active(db):
    email = unique_email("inactive")

    register_user(
        db=db,
        email=email,
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )

    with pytest.raises(HTTPException) as exc:
        login_user(
            db=db,
            email=email,
            password="Password123!",
        )

    assert exc.value.status_code == 403


def test_google_user_created(db):
    email = unique_email("google")

    user = get_or_create_google_user(
        db=db,
        email=email,
        google_id="google-123",
        first_name="John",
        last_name="Doe",
    )

    assert user.email == email
    assert user.status == UserStatus.PENDING_APPROVAL

    account = db.query(UserAccount).filter(UserAccount.user_id == user.id).first()

    assert account.provider == AuthProvider.GOOGLE


def test_google_user_not_duplicated(db):
    email = unique_email("google")

    user1 = get_or_create_google_user(
        db=db,
        email=email,
        google_id="123",
        first_name="John",
        last_name="Doe",
    )

    user2 = get_or_create_google_user(
        db=db,
        email=email,
        google_id="123",
        first_name="John",
        last_name="Doe",
    )

    assert user1.id == user2.id

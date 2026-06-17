from typing import Annotated

from fastapi import APIRouter, Depends, Query, HTTPException, status

from src.auth.constants import UserRole, UserStatus
from src.dependencies import DBDep
from src.schemas import ErrorResponse
from src.auth.dependencies import get_current_user, require_admin
from src.auth.models import UserAccount

from sqlalchemy import select

from .schemas import (
    BaseUserDetails,
    SearchStr,
    UserDetails,
    UsersPaged,
    UserStatusUpdate,
)
from .service import (
    UserService,
    UserNotFoundError,
    InvalidUserApprovalRoleError,
    UserOwnsItemsError,
    UserHasHistoricalReferencesError,
)

router = APIRouter(prefix="/users", tags=["Users"])


# -------------------------
# helper
# -------------------------
def to_user_details(user, account: UserAccount | None = None) -> UserDetails:
    return UserDetails(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name or "",
        role=user.role,
        status=user.status,
        provider=account.provider if account else None,
        provider_user_id=account.provider_user_id if account else None,
    )


# -------------------------
# GET /users (ADMIN ONLY)
# -------------------------
from sqlalchemy import select

@router.get(
    "",
    response_model=UsersPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj użytkowników",
)
def read_users(
    db: DBDep,
    admin=Depends(require_admin),
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    role: UserRole | None = None,
    status: UserStatus | None = None,
    search: SearchStr | None = None,
) -> UsersPaged:

    service = UserService(db)

    users, total_count = service.list_users(
        page=page,
        limit=limit,
        role=role,
        status=status,
        search=search,
    )

    user_ids = [u.id for u in users]

    accounts = db.execute(
        select(UserAccount).where(UserAccount.user_id.in_(user_ids))
    ).scalars().all()

    account_map = {a.user_id: a for a in accounts}

    return UsersPaged(
        items=[
            to_user_details(u, account_map.get(u.id))
            for u in users
        ],
        total_count=total_count,
    )


# -------------------------
# GET /users/{id} (ADMIN ONLY)
# -------------------------
@router.get("/{user_id}")
def read_user(user_id: int, db: DBDep, admin=Depends(require_admin)):

    service = UserService(db)

    try:
        user = service.get_user(user_id)
    except UserNotFoundError:
        raise HTTPException(404, "Nie znaleziono użytkownika.")

    account = db.execute(
        select(UserAccount).where(UserAccount.user_id == user_id)
    ).scalar_one_or_none()

    return to_user_details(user, account)


# -------------------------
# PUT /users/{id} (ADMIN ONLY)
# -------------------------
@router.put(
    "/{user_id}",
    response_model=UserDetails,
    status_code=status.HTTP_200_OK,
    summary="Edytuj dane użytkownika",
)
def update_user(
    user_id: int,
    data: BaseUserDetails,
    db: DBDep,
    admin=Depends(require_admin),
) -> UserDetails:
    service = UserService(db)

    try:
        user = service.update_user(user_id, data)
    except UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono użytkownika.",
        )
    except InvalidUserApprovalRoleError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Przy aktywacji konta należy nadać rolę user albo observer.",
        )

    return to_user_details(user)


# -------------------------
# PATCH /users/{id}/approval (ADMIN ONLY)
# -------------------------
@router.patch(
    "/{user_id}/approval",
    response_model=UserDetails,
    status_code=status.HTTP_200_OK,
    summary="Aktualizuj status użytkownika",
)
def update_user_approval(
    user_id: int,
    data: UserStatusUpdate,
    db: DBDep,
    admin=Depends(require_admin),
) -> UserDetails:
    service = UserService(db)
    try:
        user = service.update_status(user_id, data.status)
    except UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono użytkownika.",
        )

    return to_user_details(user)


# -------------------------
# DELETE /users/{id} (ADMIN ONLY)
# -------------------------
@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń użytkownika",
)
def delete_user(
    user_id: int,
    db: DBDep,
    admin=Depends(require_admin),
) -> None:
    service = UserService(db)

    try:
        service.delete_user(user_id)
    except UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono użytkownika.",
        )
    except UserOwnsItemsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Użytkownik jest właścicielem przedmiotów. Najpierw przepisz dane.",
        )
    except UserHasHistoricalReferencesError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Użytkownik ma historię powiązań – użyj dezaktywacji zamiast usuwania.",
        )
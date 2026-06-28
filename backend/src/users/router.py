from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Query, status
from sqlalchemy import select

from src.auth.constants import UserRole, UserStatus
from src.auth.dependencies import RequireAdmin, RequireUserOrAdmin
from src.auth.models import UserAccount
from src.dependencies import DBDep
from src.schemas import ErrorResponse

from .schemas import (
    BaseUserDetails,
    GuestBrowse,
    GuestUserCreate,
    GuestUserUpdate,
    SearchStr,
    UserDetails,
    UsersBrowsePaged,
    UsersPaged,
    UserStatusUpdate,
)
from .service import (
    GuestUserNotFoundError,
    InvalidUserApprovalRoleError,
    UserEmailTakenError,
    UserHasHistoricalReferencesError,
    UserIsSystemAccountError,
    UserNotFoundError,
    UserOwnsItemsError,
    UserService,
)

router = APIRouter(prefix="/users", tags=["Users"])


def to_user_details(user, account: UserAccount | None = None) -> UserDetails:
    return UserDetails(
        id=user.id,
        email=user.email or "",
        first_name=user.first_name,
        last_name=user.last_name or "",
        role=user.role,
        status=user.status,
        provider=account.provider if account else None,
        provider_user_id=account.provider_user_id if account else None,
    )


def to_guest_browse(user) -> GuestBrowse:
    return GuestBrowse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        role="guest",
    )


@router.get(
    "",
    response_model=UsersPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj użytkowników",
)
def read_users(
    db: DBDep,
    admin: RequireAdmin,
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
    accounts = db.execute(select(UserAccount).where(UserAccount.user_id.in_(user_ids))).scalars().all()
    account_map = {a.user_id: a for a in accounts}

    return UsersPaged(
        users=[to_user_details(u, account_map.get(u.id)) for u in users],
        total_count=total_count,
    )


@router.get(
    "/browse",
    response_model=UsersBrowsePaged,
    status_code=status.HTTP_200_OK,
    summary="Przeglądaj użytkowników (ograniczone dane)",
)
def browse_users(
    db: DBDep,
    current_user: RequireUserOrAdmin,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    search: SearchStr | None = None,
) -> UsersBrowsePaged:
    service = UserService(db)
    users, total_count = service.list_browse_users(page=page, limit=limit, search=search)
    return UsersBrowsePaged(users=users, total_count=total_count)


@router.post(
    "/guests",
    response_model=GuestBrowse,
    status_code=status.HTTP_201_CREATED,
    summary="Utwórz gościa",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Podany adres email jest już zajęty.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Brak uprawnień do dodania gościa.",
        },
    },
)
def create_guest(
    data: GuestUserCreate,
    db: DBDep,
    current_user: RequireUserOrAdmin,
) -> GuestBrowse:
    service = UserService(db)

    try:
        guest = service.create_guest_user(data)
    except UserEmailTakenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podany adres email jest już zajęty.",
        ) from exc

    return to_guest_browse(guest)


@router.get("/{user_id}")
def read_user(user_id: int, db: DBDep, admin: RequireAdmin):
    service = UserService(db)

    try:
        user = service.get_user(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(404, "Nie znaleziono użytkownika.") from exc

    if user.role == UserRole.GUEST:
        return to_guest_browse(user)

    account = db.execute(select(UserAccount).where(UserAccount.user_id == user_id)).scalar_one_or_none()
    return to_user_details(user, account)


@router.put(
    "/{user_id}",
    response_model=UserDetails | GuestBrowse,
    status_code=status.HTTP_200_OK,
    summary="Edytuj dane użytkownika lub gościa",
)
def update_user(
    user_id: int,
    db: DBDep,
    admin: RequireAdmin,
    payload: Annotated[dict, Body()],
) -> UserDetails | GuestBrowse:
    service = UserService(db)

    try:
        existing = service.get_user(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono użytkownika.",
        ) from exc

    if existing.role == UserRole.GUEST:
        data = GuestUserUpdate.model_validate(payload)
        try:
            guest = service.update_guest_user(user_id, data)
        except GuestUserNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nie znaleziono gościa.",
            ) from exc
        except UserEmailTakenError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Podany adres email jest już zajęty.",
            ) from exc
        return to_guest_browse(guest)

    data = BaseUserDetails.model_validate(payload)
    try:
        user = service.update_user(user_id, data)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono użytkownika.",
        ) from exc
    except InvalidUserApprovalRoleError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Przy aktywacji konta należy nadać rolę user albo observer.",
        ) from exc

    return to_user_details(user)


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
    admin: RequireAdmin,
) -> UserDetails:
    service = UserService(db)
    try:
        user = service.update_status(user_id, data.status)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono użytkownika.",
        ) from exc

    return to_user_details(user)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń użytkownika lub gościa",
)
def delete_user(
    user_id: int,
    db: DBDep,
    admin: RequireAdmin,
) -> None:
    service = UserService(db)

    try:
        service.delete_user(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono użytkownika.",
        ) from exc
    except UserOwnsItemsError as exc:
        item_count = exc.item_count
        detail = (
            f"Nie można usunąć użytkownika, ponieważ jest właścicielem {item_count} "
            f"{'przedmiotu' if item_count == 1 else 'przedmiotów'}. "
            "Najpierw przepisz przedmioty do innego użytkownika."
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        ) from exc
    except UserIsSystemAccountError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nie można usunąć konta systemowego.",
        ) from exc
    except UserHasHistoricalReferencesError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Użytkownik ma historię powiązań – użyj dezaktywacji zamiast usuwania.",
        ) from exc

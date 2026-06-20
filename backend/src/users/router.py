from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from src.auth.constants import UserRole, UserStatus
from src.auth.dependencies import CurrentUser, RequireAdmin, RequireUserOrAdmin
from src.auth.models import UserAccount
from src.dependencies import DBDep
from src.schemas import ErrorResponse

from .constants import DEFAULT_USER_SELECT_PAGE_SIZE, MAX_USER_SELECT_PAGE_SIZE
from .schemas import (
    BaseUserDetails,
    GuestUserCreate,
    GuestUserUpdate,
    SearchStr,
    UserDetails,
    UserSummary,
    UsersPaged,
    UsersSummaryPaged,
    UserStatusUpdate,
)
from .service import (
    GuestUserNotFoundError,
    InvalidUserApprovalRoleError,
    UserEmailTakenError,
    UserHasHistoricalReferencesError,
    UserNotFoundError,
    UserOwnsItemsError,
    UserService,
)

router = APIRouter(prefix="/users", tags=["Users"])


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


@router.post(
    "/guest",
    response_model=UserDetails,
    status_code=status.HTTP_201_CREATED,
    summary="Dodaj Gościa",
    responses={
        status.HTTP_201_CREATED: {
            "model": UserDetails,
            "description": "Pomyślnie utworzono profil Gościa.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Podany adres email jest już zajęty.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Brak uprawnień do dodania Gościa.",
        },
    },
)
def create_guest_user(
    data: GuestUserCreate,
    db: DBDep,
    current_user: RequireUserOrAdmin,
) -> UserDetails:
    service = UserService(db)

    try:
        guest = service.create_guest_user(data)
    except UserEmailTakenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podany adres email jest już zajęty.",
        ) from exc

    return to_user_details(guest)


@router.get(
    "/names",
    response_model=UsersSummaryPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj użytkowników do wyboru",
    responses={
        status.HTTP_200_OK: {
            "model": UsersSummaryPaged,
            "description": "Pomyślnie zwrócono skróconą listę użytkowników.",
        },
    },
)
def list_users_names(
    db: DBDep,
    current_user: CurrentUser,
    search: SearchStr | None = None,
    role: UserRole | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=MAX_USER_SELECT_PAGE_SIZE)] = DEFAULT_USER_SELECT_PAGE_SIZE,
) -> UsersSummaryPaged:
    service = UserService(db)

    users, total_count = service.list_users_names(
        page=page,
        limit=limit,
        role=role,
        search=search,
    )

    return UsersSummaryPaged(
        users=[UserSummary.model_validate(user) for user in users],
        total_count=total_count,
    )


@router.get("/{user_id}")
def read_user(user_id: int, db: DBDep, admin: RequireAdmin):

    service = UserService(db)

    try:
        user = service.get_user(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(404, "Nie znaleziono użytkownika.") from exc

    account = db.execute(select(UserAccount).where(UserAccount.user_id == user_id)).scalar_one_or_none()

    return to_user_details(user, account)


@router.put(
    "/{user_id}",
    response_model=UserDetails,
    status_code=status.HTTP_200_OK,
    summary="Edytuj dane użytkownika",
)
def update_user(
    user_id: int,
    data: BaseUserDetails | GuestUserUpdate,
    db: DBDep,
    admin: RequireAdmin,
) -> UserDetails:
    service = UserService(db)

    if isinstance(data, GuestUserUpdate):
        try:
            user = service.update_guest_user(user_id, data)
        except GuestUserNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nie znaleziono Gościa.",
            ) from exc
        except UserEmailTakenError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Podany adres email jest już zajęty.",
            ) from exc
        return to_user_details(user)

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
    summary="Usuń użytkownika",
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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Nie można usunąć użytkownika, ponieważ jest właścicielem przedmiotów. "
                "Najpierw przepisz przedmioty do innego użytkownika."
            ),
        ) from exc
    except UserHasHistoricalReferencesError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Użytkownik ma historię powiązań – użyj dezaktywacji zamiast usuwania.",
        ) from exc

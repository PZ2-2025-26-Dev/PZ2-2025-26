from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.auth.dependencies import CurrentUser, RequireUserOrAdmin
from src.auth.schemas import UserID
from src.dependencies import DBDep
from src.items.schemas import ItemID
from src.loans.constants import (
    DEFAULT_LOAN_PAGE_SIZE,
    MAX_LOAN_PAGE_SIZE,
    LoanStatus,
)
from src.loans.exceptions import (
    ItemNotAvailableError,
    LoanAlreadyReturnedError,
    LoanBorrowerNotFoundError,
    LoanBorrowerNotGuestError,
    LoanItemNotFoundError,
    LoanNotFoundError,
)
from src.loans.schemas import LoanCreate, LoanID, LoanResponse, LoansPaged
from src.loans.service import LoanService
from src.schemas import ErrorResponse

router = APIRouter(prefix="/loans", tags=["Loans"])


@router.post(
    "",
    response_model=LoanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Zarejestruj wypożyczenie obiektu Gościowi",
    responses={
        status.HTTP_201_CREATED: {
            "model": LoanResponse,
            "description": "Pomyślnie zarejestrowano wypożyczenie.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Wskazany borrower nie jest Gościem lub dane są niepoprawne.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Brak uprawnień do rejestracji wypożyczenia.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono przedmiotu lub Gościa.",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Przedmiot nie jest dostępny do wypożyczenia.",
        },
    },
)
def register_loan(
    data: LoanCreate,
    db: DBDep,
    current_user: RequireUserOrAdmin,
) -> LoanResponse:
    service = LoanService(db)

    try:
        loan = service.register_loan(
            item_id=data.item_id,
            borrower_id=data.borrower_id,
            registered_by_id=current_user.id,
            declared_return_date=data.declared_return_date,
            loan_purpose=data.loan_purpose,
        )
    except (LoanItemNotFoundError, LoanBorrowerNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono przedmiotu lub Gościa.",
        ) from exc
    except LoanBorrowerNotGuestError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wypożyczenie można przypisać wyłącznie do Gościa.",
        ) from exc
    except ItemNotAvailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Przedmiot nie jest dostępny do wypożyczenia.",
        ) from exc

    return LoanResponse.model_validate(loan)


@router.get(
    "",
    response_model=LoansPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj wypożyczenia (historia)",
    responses={
        status.HTTP_200_OK: {
            "model": LoansPaged,
            "description": "Pomyślnie zwrócono listę wypożyczeń wg filtrów.",
        },
    },
)
def list_loans(
    db: DBDep,
    current_user: CurrentUser,
    item_id: ItemID | None = None,
    borrower_id: UserID | None = None,
    loan_status: LoanStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=MAX_LOAN_PAGE_SIZE)] = DEFAULT_LOAN_PAGE_SIZE,
) -> LoansPaged:
    service = LoanService(db)

    loans, total_count = service.list_loans(
        page=page,
        limit=limit,
        item_id=item_id,
        borrower_id=borrower_id,
        status=loan_status,
    )

    return LoansPaged(
        loans=[LoanResponse.model_validate(loan) for loan in loans],
        total_count=total_count,
    )


@router.get(
    "/{loan_id}",
    response_model=LoanResponse,
    status_code=status.HTTP_200_OK,
    summary="Pobierz szczegóły wypożyczenia",
    responses={
        status.HTTP_200_OK: {
            "model": LoanResponse,
            "description": "Pomyślnie zwrócono szczegóły wypożyczenia.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono wypożyczenia.",
        },
    },
)
def read_loan(
    loan_id: LoanID,
    db: DBDep,
    current_user: CurrentUser,
) -> LoanResponse:
    service = LoanService(db)

    try:
        loan = service.get_loan(loan_id)
    except LoanNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono wypożyczenia.",
        ) from exc

    return LoanResponse.model_validate(loan)


@router.post(
    "/{loan_id}/return",
    response_model=LoanResponse,
    status_code=status.HTTP_200_OK,
    summary="Zarejestruj zwrot wypożyczenia",
    responses={
        status.HTTP_200_OK: {
            "model": LoanResponse,
            "description": "Pomyślnie zarejestrowano zwrot.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Wypożyczenie zostało już zwrócone.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Brak uprawnień do rejestracji zwrotu.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono wypożyczenia.",
        },
    },
)
def return_loan(
    loan_id: LoanID,
    db: DBDep,
    current_user: RequireUserOrAdmin,
) -> LoanResponse:
    service = LoanService(db)

    try:
        loan = service.return_loan(loan_id, returned_by_id=current_user.id)
    except LoanNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono wypożyczenia.",
        ) from exc
    except LoanAlreadyReturnedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wypożyczenie zostało już zwrócone.",
        ) from exc

    return LoanResponse.model_validate(loan)

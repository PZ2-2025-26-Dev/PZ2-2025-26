from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status

from src.auth.dependencies import RequireUserOrAdmin
from src.dependencies import DBDep
from src.loans.constants import LoanStatus
from src.loans.schemas import (
    LoanCreate,
    LoanCreateExternal,
    LoanDecision,
    LoanListResponse,
    LoanResponse,
)
from src.loans.service import (
    AccessDeniedError,
    GuestNotFoundError,
    InvalidLoanStatusError,
    ItemNotAvailableError,
    ItemNotFoundError,
    LoanNotFoundError,
    LoanService,
)

router = APIRouter(prefix="/loans", tags=["Loans"])


@router.post(
    "",
    response_model=LoanResponse,
    status_code=http_status.HTTP_201_CREATED,
    summary="Złóż wniosek o wypożyczenie",
)
def create_loan(
    data: LoanCreate,
    db: DBDep,
    user: RequireUserOrAdmin,
) -> LoanResponse:
    try:
        return LoanService(db).create_loan(data, user)
    except ItemNotFoundError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Nie znaleziono przedmiotu") from exc
    except ItemNotAvailableError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/external",
    response_model=LoanResponse,
    status_code=http_status.HTTP_201_CREATED,
    summary="Wypożycz przedmiot dla gościa",
)
def create_external_loan(
    data: LoanCreateExternal,
    db: DBDep,
    user: RequireUserOrAdmin,
) -> LoanResponse:
    try:
        return LoanService(db).create_external_loan(data, user)
    except ItemNotFoundError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Nie znaleziono przedmiotu") from exc
    except GuestNotFoundError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Nie znaleziono gościa") from exc
    except ItemNotAvailableError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except AccessDeniedError as exc:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.get(
    "",
    response_model=LoanListResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Wylistuj wypożyczenia",
)
def list_loans(
    db: DBDep,
    user: RequireUserOrAdmin,
    loan_status: LoanStatus | None = Query(default=None, alias="status"),
) -> LoanListResponse:
    loans = LoanService(db).list_loans(user, loan_status=loan_status)
    return LoanListResponse(loans=loans)


@router.get(
    "/{loan_id}",
    response_model=LoanResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Pobierz szczegóły wypożyczenia",
)
def get_loan(
    loan_id: int,
    db: DBDep,
    user: RequireUserOrAdmin,
) -> LoanResponse:
    try:
        return LoanService(db).get_loan(loan_id, user)
    except LoanNotFoundError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Nie znaleziono wypożyczenia") from exc
    except AccessDeniedError as exc:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Brak dostępu") from exc


@router.post(
    "/{loan_id}/approve",
    response_model=LoanResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Zatwierdź wniosek o wypożyczenie",
)
def approve_loan(
    loan_id: int,
    data: LoanDecision,
    db: DBDep,
    user: RequireUserOrAdmin,
) -> LoanResponse:
    try:
        return LoanService(db).approve_loan(loan_id, user, data)
    except LoanNotFoundError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Nie znaleziono wypożyczenia") from exc
    except AccessDeniedError as exc:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except InvalidLoanStatusError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/{loan_id}/deny",
    response_model=LoanResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Odrzuć wniosek o wypożyczenie",
)
def deny_loan(
    loan_id: int,
    data: LoanDecision,
    db: DBDep,
    user: RequireUserOrAdmin,
) -> LoanResponse:
    try:
        return LoanService(db).deny_loan(loan_id, user, data)
    except LoanNotFoundError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Nie znaleziono wypożyczenia") from exc
    except AccessDeniedError as exc:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except InvalidLoanStatusError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/{loan_id}/activate",
    response_model=LoanResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Potwierdź fizyczne wydanie przedmiotu",
)
def activate_loan(
    loan_id: int,
    db: DBDep,
    user: RequireUserOrAdmin,
) -> LoanResponse:
    try:
        return LoanService(db).activate_loan(loan_id, user)
    except LoanNotFoundError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Nie znaleziono wypożyczenia") from exc
    except AccessDeniedError as exc:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except InvalidLoanStatusError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/{loan_id}/return",
    response_model=LoanResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Potwierdź zwrot przedmiotu",
)
def return_loan(
    loan_id: int,
    data: LoanDecision,
    db: DBDep,
    user: RequireUserOrAdmin,
) -> LoanResponse:
    try:
        return LoanService(db).return_loan(loan_id, user, data)
    except LoanNotFoundError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Nie znaleziono wypożyczenia") from exc
    except AccessDeniedError as exc:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except InvalidLoanStatusError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from exc

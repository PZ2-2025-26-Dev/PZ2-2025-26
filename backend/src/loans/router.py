from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status

from src.auth.dependencies import RequireUserOrAdmin
from src.dependencies import DBDep
from src.loans.constants import LoanListScope, LoanStatus
from src.loans.schemas import (
    LoanConfirmReturn,
    LoanCreate,
    LoanCreateExternal,
    LoanDecision,
    LoanListResponse,
    LoanResponse,
    LoanReturn,
)
from src.loans.service import (
    AccessDeniedError,
    BorrowerNotFoundError,
    GuestNotFoundError,
    InvalidLoanStatusError,
    ItemNotAvailableError,
    ItemNotFoundError,
    LoanNotFoundError,
    LoanService,
)
from src.schemas import ErrorResponse

router = APIRouter(prefix="/loans", tags=["Loans"])

NOT_FOUND_RESPONSE = {
    "model": ErrorResponse,
    "description": "Nie znaleziono wskazanego zasobu.",
}
FORBIDDEN_RESPONSE = {
    "model": ErrorResponse,
    "description": "Brak uprawnień do wykonania operacji.",
}
CONFLICT_RESPONSE = {
    "model": ErrorResponse,
    "description": "Operacja jest niedozwolona dla bieżącego stanu wypożyczenia lub przedmiotu.",
}


@router.post(
    "",
    response_model=LoanResponse,
    status_code=http_status.HTTP_201_CREATED,
    summary="Utwórz wniosek lub aktywne wypożyczenie",
    responses={
        http_status.HTTP_201_CREATED: {
            "model": LoanResponse,
            "description": "Wypożyczenie zostało zarejestrowane.",
        },
        http_status.HTTP_403_FORBIDDEN: FORBIDDEN_RESPONSE,
        http_status.HTTP_404_NOT_FOUND: NOT_FOUND_RESPONSE,
        http_status.HTTP_409_CONFLICT: CONFLICT_RESPONSE,
    },
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
    except (BorrowerNotFoundError, GuestNotFoundError) as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AccessDeniedError as exc:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ItemNotAvailableError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/external",
    response_model=LoanResponse,
    status_code=http_status.HTTP_201_CREATED,
    summary="Wypożycz przedmiot dla gościa",
    responses={
        http_status.HTTP_201_CREATED: {
            "model": LoanResponse,
            "description": "Wypożyczenie dla gościa zostało zarejestrowane.",
        },
        http_status.HTTP_403_FORBIDDEN: FORBIDDEN_RESPONSE,
        http_status.HTTP_404_NOT_FOUND: NOT_FOUND_RESPONSE,
        http_status.HTTP_409_CONFLICT: CONFLICT_RESPONSE,
    },
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AccessDeniedError as exc:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ItemNotAvailableError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get(
    "",
    response_model=LoanListResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Wylistuj wypożyczenia",
    responses={
        http_status.HTTP_200_OK: {
            "model": LoanListResponse,
            "description": "Pomyślnie zwrócono listę wypożyczeń.",
        },
        http_status.HTTP_403_FORBIDDEN: FORBIDDEN_RESPONSE,
    },
)
def list_loans(
    db: DBDep,
    user: RequireUserOrAdmin,
    loan_status: Annotated[LoanStatus | None, Query(alias="status")] = None,
    scope: LoanListScope = LoanListScope.MY,
) -> LoanListResponse:
    try:
        loans = LoanService(db).list_loans(user, loan_status=loan_status, scope=scope)
    except AccessDeniedError as exc:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return LoanListResponse(loans=loans)


@router.get(
    "/{loan_id}",
    response_model=LoanResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Pobierz szczegóły wypożyczenia",
    responses={
        http_status.HTTP_200_OK: {
            "model": LoanResponse,
            "description": "Pomyślnie zwrócono szczegóły wypożyczenia.",
        },
        http_status.HTTP_403_FORBIDDEN: FORBIDDEN_RESPONSE,
        http_status.HTTP_404_NOT_FOUND: NOT_FOUND_RESPONSE,
    },
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
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.post(
    "/{loan_id}/approve",
    response_model=LoanResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Zatwierdź albo odrzuć wniosek o wypożyczenie",
    responses={
        http_status.HTTP_200_OK: {
            "model": LoanResponse,
            "description": "Decyzja właściciela została zapisana.",
        },
        http_status.HTTP_403_FORBIDDEN: FORBIDDEN_RESPONSE,
        http_status.HTTP_404_NOT_FOUND: NOT_FOUND_RESPONSE,
        http_status.HTTP_409_CONFLICT: CONFLICT_RESPONSE,
    },
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
    responses={
        http_status.HTTP_200_OK: {
            "model": LoanResponse,
            "description": "Wniosek został odrzucony.",
        },
        http_status.HTTP_403_FORBIDDEN: FORBIDDEN_RESPONSE,
        http_status.HTTP_404_NOT_FOUND: NOT_FOUND_RESPONSE,
        http_status.HTTP_409_CONFLICT: CONFLICT_RESPONSE,
    },
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
    "/{loan_id}/return",
    response_model=LoanResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Zgłoś albo zamknij zwrot wypożyczenia",
    responses={
        http_status.HTTP_200_OK: {
            "model": LoanResponse,
            "description": "Zwrot został zgłoszony albo potwierdzony przez właściciela.",
        },
        http_status.HTTP_403_FORBIDDEN: FORBIDDEN_RESPONSE,
        http_status.HTTP_404_NOT_FOUND: NOT_FOUND_RESPONSE,
        http_status.HTTP_409_CONFLICT: CONFLICT_RESPONSE,
    },
)
def return_loan(
    loan_id: int,
    data: LoanReturn,
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


@router.post(
    "/{loan_id}/confirm-return",
    response_model=LoanResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Potwierdź albo odrzuć zgłoszony zwrot",
    responses={
        http_status.HTTP_200_OK: {
            "model": LoanResponse,
            "description": "Decyzja dotycząca zwrotu została zapisana.",
        },
        http_status.HTTP_403_FORBIDDEN: FORBIDDEN_RESPONSE,
        http_status.HTTP_404_NOT_FOUND: NOT_FOUND_RESPONSE,
        http_status.HTTP_409_CONFLICT: CONFLICT_RESPONSE,
    },
)
def confirm_return(
    loan_id: int,
    data: LoanConfirmReturn,
    db: DBDep,
    user: RequireUserOrAdmin,
) -> LoanResponse:
    try:
        return LoanService(db).confirm_return(loan_id, user, data)
    except LoanNotFoundError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Nie znaleziono wypożyczenia") from exc
    except AccessDeniedError as exc:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except InvalidLoanStatusError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from exc

from fastapi import APIRouter, Depends, HTTPException, status
from src.auth.dependencies import get_current_user
from src.auth.schemas import User
from src.dependencies import DBDep
from src.schemas import ErrorResponse

from .schemas import ExternalLoanCreate, LoanCreateResponse
from .service import (LoanConflictError, LoanForbiddenError, LoanNotFoundError,
                      LoanService)

router = APIRouter(prefix="/loans")


@router.post(
    "",
    response_model=LoanCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Wypożycz sprzęt podmiotowi zewnętrznemu",
    responses={
        status.HTTP_201_CREATED: {
            "model": LoanCreateResponse,
            "description": "Pomyślnie utworzono wypożyczenie.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "Brak poprawnego tokenu JWT.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Użytkownik nie ma uprawnień do wykonania operacji.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono sprzętu lub gościa.",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Sprzęt nie jest dostępny do wypożyczenia.",
        },
    },
)
def create_external_loan(
    data: ExternalLoanCreate,
    db: DBDep,
    current_user: User = Depends(get_current_user),
) -> LoanCreateResponse:
    service = LoanService(db)

    try:
        loan = service.create_external_loan(data, current_user)
    except LoanNotFoundError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err
    except LoanForbiddenError as err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(err)) from err
    except LoanConflictError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err)) from err

    return LoanCreateResponse.model_validate(loan, from_attributes=True)

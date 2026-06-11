from datetime import datetime, time

from fastapi import APIRouter, Depends, HTTPException, Header, status
from src.auth.dependencies import get_current_user
from src.auth.schemas import User
from src.config import config
from src.constants import Environment
from src.dependencies import DBDep
from src.schemas import ErrorResponse
from src.utils import now

from .constants import EXTERNAL_LOAN_PURPOSE, LoanStatus
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
    x_demo_mock: str | None = Header(default=None, alias="X-Demo-Mock"),
) -> LoanCreateResponse:
    service = LoanService(db)

    try:
        loan = service.create_external_loan(data, current_user)
    except LoanNotFoundError as err:
        # Dev-only fallback for demo flow when FE uses mock item IDs not present in DB.
        if config.env == Environment.DEV and x_demo_mock == "1":
            declared_return_datetime = datetime.combine(data.declared_return_date, time.max)
            mocked_timestamp = now()
            return LoanCreateResponse(
                id=999_999,
                item_id=data.item_id,
                guest_id=data.guest_id,
                declared_return_date=declared_return_datetime,
                loan_purpose=EXTERNAL_LOAN_PURPOSE,
                status=LoanStatus.LOANED,
                decision_by=current_user.id,
                decision_at=mocked_timestamp,
                borrowed_at=mocked_timestamp,
            )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err
    except LoanForbiddenError as err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(err)) from err
    except LoanConflictError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err)) from err

    return LoanCreateResponse.model_validate(loan, from_attributes=True)

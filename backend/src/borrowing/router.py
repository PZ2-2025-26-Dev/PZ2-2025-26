from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.borrowing.schemas import (
    BorrowRequestCreate,
    BorrowRequestRead,
    BorrowReturnCreate,
    GuestCreate,
    GuestRead,
)
from src.borrowing.service import BorrowingService
from src.database import get_db


# Podmień na swoje prawdziwe zależności z modułu auth
def get_current_user():
    return type("User", (), {"id": 1, "is_admin": False})()


router = APIRouter(prefix="/borrowing", tags=["Borrowing"])


@router.post("/guests", response_model=GuestRead)
def create_guest(
    data: GuestCreate,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = BorrowingService(session)
    return service.create_guest(data, current_user.id)


@router.post("/requests", response_model=BorrowRequestRead)
def request_borrow(
    data: BorrowRequestCreate,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = BorrowingService(session)
    # Przekazujemy cały obiekt użytkownika do weryfikacji uprawnień
    return service.request_borrow(data, current_user)


@router.post("/requests/{request_id}/approve", response_model=BorrowRequestRead)
def approve_borrow(
    request_id: int,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = BorrowingService(session)
    return service.approve_borrow(request_id, current_user)


@router.post("/requests/{request_id}/return", response_model=BorrowRequestRead)
def return_borrow(
    request_id: int,
    data: BorrowReturnCreate,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = BorrowingService(session)
    return service.return_equipment(request_id, data, current_user)

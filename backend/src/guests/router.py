from fastapi import APIRouter, HTTPException, status
from src.dependencies import DBDep
from src.guests.models import Guest as GuestModel
from src.guests.schemas import Guest

router = APIRouter(prefix="/guests")


@router.get(
    "",
    response_model=list[Guest],
    status_code=status.HTTP_200_OK,
    summary="Wylistuj podmioty zewnętrzne (Goście)",
)
def read_guests(db: DBDep) -> list[Guest]:
    # Proste zwrócenie listy gości z bazy
    guests = db.query(GuestModel).all()

    return guests


@router.get(
    "/{guest_id}",
    response_model=Guest,
    status_code=status.HTTP_200_OK,
    summary="Szczegóły Gościa",
)
def read_guest(guest_id: int, db: DBDep) -> Guest:
    guest = db.get(GuestModel, guest_id)
    if not guest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")

    return guest

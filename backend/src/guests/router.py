from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from src.dependencies import DBDep
from src.guests.models import Guest

router = APIRouter(prefix="/guests")


@router.get("", status_code=status.HTTP_200_OK, summary="Wylistuj podmioty zewnętrzne (Goście)")
def read_guests(db: DBDep) -> list[dict]:
    # Proste zwrócenie listy gości z bazy
    guests = db.query(Guest).all()

    return [
        {
            "id": g.id,
            "first_name": g.first_name,
            "last_name": g.last_name,
            "email": g.email,
            "description": g.description,
        }
        for g in guests
    ]


@router.get("/{guest_id}", status_code=status.HTTP_200_OK, summary="Szczegóły Gościa")
def read_guest(guest_id: int, db: DBDep) -> dict:
    guest = db.get(Guest, guest_id)
    if not guest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")

    return {
        "id": guest.id,
        "first_name": guest.first_name,
        "last_name": guest.last_name,
        "email": guest.email,
        "description": guest.description,
    }

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.location.schemas import (
    BuildingCreate,
    BuildingRead,
    BuildingUpdate,
    RoomCreate,
    RoomRead,
    RoomUpdate,
)
from src.location.service import LocationService


def require_admin():
    pass


router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("/")
def get_locations(session: Session = Depends(get_db)):
    # Zwraca strukturę z odfiltrowanymi ukrytymi elementami
    service = LocationService(session)
    return service.get_visible_locations()


@router.post("/buildings", response_model=BuildingRead, dependencies=[Depends(require_admin)])
def create_building(data: BuildingCreate, session: Session = Depends(get_db)):
    service = LocationService(session)
    return service.create_building(data)


@router.patch("/buildings/{building_id}", response_model=BuildingRead, dependencies=[Depends(require_admin)])
def update_building(building_id: int, data: BuildingUpdate, session: Session = Depends(get_db)):
    service = LocationService(session)
    return service.update_building(building_id, data)


@router.post("/rooms", response_model=RoomRead, dependencies=[Depends(require_admin)])
def create_room(data: RoomCreate, session: Session = Depends(get_db)):
    service = LocationService(session)
    return service.create_room(data)


@router.patch("/rooms/{room_id}", response_model=RoomRead, dependencies=[Depends(require_admin)])
def update_room(room_id: int, data: RoomUpdate, session: Session = Depends(get_db)):
    service = LocationService(session)
    return service.update_room(room_id, data)

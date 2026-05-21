from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.location.models import Building, Room
from src.location.schemas import BuildingCreate, BuildingUpdate, RoomCreate, RoomUpdate


class LocationService:
    def __init__(self, session: Session):
        self.session = session

    def create_building(self, data: BuildingCreate) -> Building:
        if self.session.query(Building).filter_by(name=data.name).first():
            raise HTTPException(status_code=400, detail="Building with this name already exists")

        building = Building(**data.model_dump())
        self.session.add(building)
        self.session.commit()
        self.session.refresh(building)
        return building

    def update_building(self, building_id: int, data: BuildingUpdate) -> Building:
        building = self.session.get(Building, building_id)
        if not building:
            raise HTTPException(status_code=404, detail="Building not found")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(building, key, value)

        self.session.commit()
        self.session.refresh(building)
        return building

    def create_room(self, data: RoomCreate) -> Room:
        building = self.session.get(Building, data.building_id)
        if not building:
            raise HTTPException(status_code=404, detail="Building not found")

        room = Room(**data.model_dump())
        self.session.add(room)
        self.session.commit()
        self.session.refresh(room)
        return room

    def update_room(self, room_id: int, data: RoomUpdate) -> Room:
        room = self.session.get(Room, room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(room, key, value)

        self.session.commit()
        self.session.refresh(room)
        return room

    # Metoda dla zwykłych użytkowników - zwraca tylko nieukryte lokalizacje
    def get_visible_locations(self):
        buildings = self.session.query(Building).filter_by(is_hidden=False).all()
        rooms = self.session.query(Room).filter_by(is_hidden=False).all()
        return {"buildings": buildings, "rooms": rooms}

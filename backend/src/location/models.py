from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from src.database import Base


class Building(Base):
    __tablename__ = "buildings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)  # np. "D10", "D11"
    is_hidden = Column(Boolean, default=False, nullable=False)

    rooms = relationship("Room", back_populates="building", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    number = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)
    is_hidden = Column(Boolean, default=False, nullable=False)
    building_id = Column(Integer, ForeignKey("buildings.id"), nullable=False)

    building = relationship("Building", back_populates="rooms")
    cabinets = relationship("Cabinet", back_populates="room", cascade="all, delete-orphan")


class Cabinet(Base):
    __tablename__ = "cabinets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)

    room = relationship("Room", back_populates="cabinets")
    shelves = relationship("Shelf", back_populates="cabinet", cascade="all, delete-orphan")


class Shelf(Base):
    __tablename__ = "shelves"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"), nullable=False)

    cabinet = relationship("Cabinet", back_populates="shelves")

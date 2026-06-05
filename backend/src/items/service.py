from uuid import uuid7

from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload, selectinload

from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory, LegacyIdentifier
from src.items.schemas import ItemCreate
from src.utils import now


class ItemService:
    def __init__(self, db: Session):
        self.db = db

    def add_item(self, data: ItemCreate) -> Item:
        inventory_number = uuid7()

        new_item = Item(
            name=data.name,
            inventory_number=inventory_number,
            category_id=data.category_id,
            location_id=data.location_id,
            owner_id=data.owner_id,
            status=ItemStatus.AVAILABLE,
            description=data.description,
        )

        self.db.add(new_item)
        self.db.flush()  

        item_history = ItemHistory(
            item_id=new_item.id,
            updated_at=now(),
            updated_by=data.owner_id,
            change_type=ItemChangeLogType.CREATED,
            description="Item created",
        )
        self.db.add(item_history)
        self.db.flush()

        if data.legacy_id is not None:
            legacy_ident = LegacyIdentifier(
                item_id=new_item.id,
                legacy_id=data.legacy_id,
            )
            self.db.add(legacy_ident)

        self.db.commit()

        return self.get_item_by_id(new_item.id)

    def get_items_paged(
        self,
        search: str | None = None,
        category_id: int | None = None,
        location_id: int | None = None,
        owner_id: int | None = None,
        status: ItemStatus | None = None,
        page: int = 1,
        limit: int = 100,
    ) -> tuple[list[Item], int]:
        """Pobiera przefiltrowaną listę przedmiotów eliminując problem N+1."""
        stmt = select(Item)

        if search:
            stmt = stmt.where(Item.name.ilike(f"%{search}%"))
        if category_id:
            stmt = stmt.where(Item.category_id == category_id)
        if location_id:
            stmt = stmt.where(Item.location_id == location_id)
        if owner_id:
            stmt = stmt.where(Item.owner_id == owner_id)
        if status:
            stmt = stmt.where(Item.status == status)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.scalar(count_stmt) or 0

        stmt = stmt.options(
            joinedload(Item.category),
            joinedload(Item.location),
            joinedload(Item.owner),
            selectinload(Item.legacy_identifier),
        )

        offset = (page - 1) * limit
        stmt = stmt.offset(offset).limit(limit)

        items = list(self.db.scalars(stmt).all())
        return items, total

    def get_item_by_id(self, item_id: int) -> Item | None:
        """Pobiera pojedynczy przedmiot ze zoptymalizowanym ładowaniem relacji."""
        stmt = (
            select(Item)
            .where(Item.id == item_id)
            .options(
                joinedload(Item.category),
                joinedload(Item.location),
                joinedload(Item.owner),
                selectinload(Item.legacy_identifier),
            )
        )
        return self.db.scalars(stmt).first()
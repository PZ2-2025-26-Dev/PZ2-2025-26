from uuid import uuid7
from sqlalchemy import select, func, String
from sqlalchemy.orm import Session, joinedload, selectinload, aliased

from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory, LegacyIdentifier
from src.items.schemas import ItemCreate
from src.locations.models import Location
from src.items.schemas import ItemUpdate
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
        """Pobiera przefiltrowaną listę przedmiotów eliminując problem N+1 oraz wylicza ścieżkę lokalizacji przez CTE."""
        
        location_cte = select(
            Location.id,
            Location.name.cast(String(512)).label("path")
        ).where(Location.parent_id == None).cte(name="location_path_cte", recursive=True)

        loc_alias = aliased(Location)
        location_cte = location_cte.union_all(
            select(
                loc_alias.id,
                func.concat(location_cte.c.path, " / ", loc_alias.name).label("path")
            ).where(loc_alias.parent_id == location_cte.c.id)
        )

        stmt = (
            select(Item, location_cte.c.path)
            .outerjoin(location_cte, Item.location_id == location_cte.c.id)
            .options(
                joinedload(Item.category),
                joinedload(Item.location),
                joinedload(Item.owner),
                selectinload(Item.legacy_identifier),
            )
        )

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

        offset = (page - 1) * limit
        stmt = stmt.offset(offset).limit(limit)

        results = self.db.execute(stmt).all()

        items = []
        for item, path in results:
            if item.location:
                item.location.path = path or item.location.name
            items.append(item)

        return items, total
    
    def get_item_by_id(self, item_id: int) -> Item | None:
        """Pobiera pojedynczy przedmiot z wyliczoną ścieżką lokalizacji za pomocą CTE."""
        location_cte = select(
            Location.id,
            Location.name.cast(String(512)).label("path")
        ).where(Location.parent_id == None).cte(name="location_path_cte", recursive=True)

        loc_alias = aliased(Location)
        location_cte = location_cte.union_all(
            select(
                loc_alias.id,
                func.concat(location_cte.c.path, " / ", loc_alias.name).label("path")
            ).where(loc_alias.parent_id == location_cte.c.id)
        )

        stmt = (
            select(Item, location_cte.c.path)
            .where(Item.id == item_id)
            .outerjoin(location_cte, Item.location_id == location_cte.c.id)
            .options(
                joinedload(Item.category),
                joinedload(Item.location),
                joinedload(Item.owner),
                selectinload(Item.legacy_identifier),
            )
        )
        
        result = self.db.execute(stmt).first()
        if result:
            item, path = result
            if item.location:
                item.location.path = path or item.location.name
            return item
        return None
        return new_item
    
    def update_item(self, item_id: int, data: ItemUpdate,) -> Item:
        """Update item fields in a single transaction.

        Raises ValueError when item does not exist.
        Returns the updated Item instance.
        """
        item = self.db.get(Item, item_id)

        if item is None:
            raise ValueError("Item not found")

        if data.description is not None:
            item.description = data.description

        self.db.commit()
        self.db.refresh(item)

        return item
    
    def get_item_history(self, item_id: int) -> list[ItemHistory]:
        """Get item history ordered by newest first.

        Raises ValueError when item does not exist.
        Returns a list of ItemHistory entries.
        """
        item = self.db.get(Item, item_id)

        if item is None:
            raise ValueError("Item not found")

        stmt = (
            select(ItemHistory)
            .where(ItemHistory.item_id == item_id)
            .order_by(ItemHistory.updated_at.desc())
        )

        return self.db.execute(stmt).scalars().all()

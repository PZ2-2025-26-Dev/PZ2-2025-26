from uuid import uuid7

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory
from src.items.schemas import ItemCreate, ItemUpdate
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
        self.db.flush()  # Get the item ID without committing

        # Create history record in the same transaction
        item_history = ItemHistory(
            item_id=new_item.id,
            updated_at=now(),
            updated_by=data.owner_id,
            change_type=ItemChangeLogType.CREATED,
            description="Item created",
        )

        self.db.add(item_history)
        self.db.commit()
        self.db.refresh(new_item)

        return new_item

    def update_item(
        self,
        item_id: int,
        data: ItemUpdate,
    ) -> Item:
        """Update item fields in a single transaction.

        Raises ValueError when item does not exist.
        Returns the updated Item instance.
        """
        item = self.db.get(Item, item_id)

        if item is None:
            raise ValueError("Item not found")

        if data.name is not None:
            item.name = data.name

        if data.category_id is not None and data.category_id != item.category_id:
            self.db.add(
                ItemHistory(
                    item_id=item.id,
                    updated_at=now(),
                    updated_by=item.owner_id,
                    change_type=ItemChangeLogType.CATEGORY_CHANGED,
                    description=f"Category changed from {item.category_id} to {data.category_id}",
                )
            )
            item.category_id = data.category_id

        if data.location_id is not None and data.location_id != item.location_id:
            self.db.add(
                ItemHistory(
                    item_id=item.id,
                    updated_at=now(),
                    updated_by=item.owner_id,
                    change_type=ItemChangeLogType.LOCATION_CHANGED,
                    description=f"Location changed from {item.location_id} to {data.location_id}",
                )
            )
            item.location_id = data.location_id

        if data.owner_id is not None and data.owner_id != item.owner_id:
            self.db.add(
                ItemHistory(
                    item_id=item.id,
                    updated_at=now(),
                    updated_by=item.owner_id,
                    change_type=ItemChangeLogType.OWNER_CHANGED,
                    description=f"Owner changed from {item.owner_id} to {data.owner_id}",
                )
            )
            item.owner_id = data.owner_id

        if data.description is not None:
            item.description = data.description

        if data.status is not None:
            item.status = data.status

        self.db.commit()
        self.db.refresh(item)

        return item

    def get_item(self, item_id: int) -> Item:
        item = self.db.execute(
            select(Item)
            .where(Item.id == item_id)
            .options(
                selectinload(Item.category),
                selectinload(Item.location),
                selectinload(Item.owner),
            )
        ).scalar_one_or_none()

        if item is None:
            raise ValueError("Item not found")

        return item

    def delete_item(self, item_id: int) -> None:
        item = self.db.get(Item, item_id)

        if item is None:
            raise ValueError("Item not found")

        self.db.delete(item)
        self.db.commit()

    def search_items(
        self,
        name: str | None,
        description: str | None,
        category_id: int | None,
        location_id: int | None,
        owner_id: int | None,
        status: ItemStatus | None,
        page: int,
        limit: int,
    ) -> tuple[list[Item], int]:
        stmt = select(Item).options(
            selectinload(Item.category),
            selectinload(Item.location),
            selectinload(Item.owner),
        )

        if owner_id is not None:
            stmt = stmt.where(Item.owner_id == owner_id)

        if category_id is not None:
            stmt = stmt.where(Item.category_id == category_id)

        if location_id is not None:
            stmt = stmt.where(Item.location_id == location_id)

        if status is not None:
            stmt = stmt.where(Item.status == status)

        if name is not None:
            stmt = stmt.where(Item.name.ilike(f"%{name}%"))

        if description is not None:
            stmt = stmt.where(Item.description.ilike(f"%{description}%"))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.execute(count_stmt).scalar_one()

        offset = (page - 1) * limit
        stmt = stmt.offset(offset).limit(limit)

        items = self.db.execute(stmt).scalars().all()

        return items, total

    def get_item_history(self, item_id: int) -> list[ItemHistory]:
        """Get item history ordered by newest first.

        Raises ValueError when item does not exist.
        Returns a list of ItemHistory entries.
        """
        item = self.db.get(Item, item_id)

        if item is None:
            raise ValueError("Item not found")

        stmt = select(ItemHistory).where(ItemHistory.item_id == item_id).order_by(ItemHistory.updated_at.desc())

        return self.db.execute(stmt).scalars().all()

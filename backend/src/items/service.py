from uuid import uuid7

from fastapi import HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory
from src.items.schemas import ItemCreate
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
    
    def delete_item(self, item_id: int) -> None:
        item = self.db.get(Item, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail="Item not found")

        if item.status == ItemStatus.LOANED:
            raise HTTPException(status_code=400, detail="Cannot delete loaned item")

        self.db.execute(delete(ItemHistory).where(ItemHistory.item_id == item_id))

        self.db.delete(item)
        self.db.commit()

    def get_item(self, item_id: int) -> Item | None:
        return self.db.get(Item, item_id)
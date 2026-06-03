from datetime import datetime
from uuid import uuid7

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.categories.models import Category
from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory
from src.locations.models import Location
from src.users.models import User
from src.items.schemas import ItemCreate


class ItemService:
    def __init__(self, db: Session):
        self.db = db

    def add_item(self, data: ItemCreate) -> Item:
        """Create item and item history in a single transaction.

        Raises ValueError on missing relations.
        Returns the newly created Item instance.
        """
        # Generate inventory number (UUIDv7)
        inventory_number = uuid7()

        # Create new item with default AVAILABLE status
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
            updated_at=datetime.now(),
            updated_by=data.owner_id,
            change_type=ItemChangeLogType.CREATED,
            description="Item created",
        )

        self.db.add(item_history)
        self.db.commit()
        self.db.refresh(new_item)

        return new_item

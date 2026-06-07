from uuid import uuid7

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.categories.models import Category
from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory
from src.items.schemas import (
    ItemCategory,
    ItemCreate,
    ItemDetails,
    ItemLocation,
    ItemOwner,
    ItemPagination,
    ItemsPaged,
)
from src.locations.models import Location
from src.locations.service import LocationService
from src.users.models import User
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

    def list_items(
        self,
        *,
        search: str | None = None,
        category_id: int | None = None,
        location_id: int | None = None,
        owner_id: int | None = None,
        status: ItemStatus | None = None,
        page: int = 1,
        limit: int = 100,
    ) -> ItemsPaged:
        filters = []

        if search is not None:
            filters.append(or_(Item.name.ilike(f"%{search}%"), Item.description.ilike(f"%{search}%")))

        if category_id is not None:
            filters.append(Item.category_id == category_id)

        if location_id is not None:
            filters.append(Item.location_id == location_id)

        if owner_id is not None:
            filters.append(Item.owner_id == owner_id)

        if status is not None:
            filters.append(Item.status == status)

        total = self.db.scalar(select(func.count()).select_from(Item).where(*filters)) or 0
        rows = self.db.execute(
            select(Item, Category, Location, User)
            .join(Category, Item.category_id == Category.id)
            .join(Location, Item.location_id == Location.id)
            .join(User, Item.owner_id == User.id)
            .where(*filters)
            .order_by(Item.id)
            .offset((page - 1) * limit)
            .limit(limit)
        ).all()

        location_service = LocationService(self.db)

        return ItemsPaged(
            items=[
                ItemDetails(
                    id=item.id,
                    name=item.name,
                    category=ItemCategory(id=category.id, name=self._build_category_path(category)),
                    location=ItemLocation(id=location.id, path=location_service.build_path(location)),
                    owner=ItemOwner(id=owner.id, name=f"{owner.first_name} {owner.last_name or ''}".strip()),
                    description=item.description,
                    status=item.status,
                    legacy_id=None,
                )
                for item, category, location, owner in rows
            ],
            pagination=ItemPagination(
                page=page,
                limit=limit,
                total=total,
            ),
        )

    def _build_category_path(self, category: Category) -> str:
        path = [category.name]
        parent_id = category.parent_id

        while parent_id is not None:
            parent = self.db.get(Category, parent_id)

            if parent is None:
                break

            path.append(parent.name)
            parent_id = parent.parent_id

        return " / ".join(reversed(path))

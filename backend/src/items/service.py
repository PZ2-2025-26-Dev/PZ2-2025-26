from uuid import uuid7

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.categories.models import Category
from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory, LegacyIdentifier
from src.items.schemas import ItemCategory, ItemCreate, ItemDetails, ItemLocation, ItemOwner, ItemUpdate
from src.locations.models import Location
from src.locations.service import collect_subtree_location_ids
from src.users.models import User
from src.utils import now


def format_user_name(user: User) -> str:
    if user.last_name:
        return f"{user.first_name} {user.last_name}"
    return user.first_name


def build_location_path(location_id: int, lookup: dict[int, Location]) -> str:
    parts: list[str] = []
    current_id: int | None = location_id
    while current_id is not None and current_id in lookup:
        loc = lookup[current_id]
        parts.append(loc.name)
        current_id = loc.parent_id
    return " / ".join(reversed(parts))


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
        self.db.commit()
        self.db.refresh(new_item)

        return new_item

    def list_items(
        self,
        *,
        search: str | None = None,
        category_id: int | None = None,
        location_id: int | None = None,
        include_descendants: bool = False,
        owner_id: int | None = None,
        statuses: list[ItemStatus] | None = None,
        page: int = 1,
        limit: int = 100,
    ) -> tuple[list[ItemDetails], int]:
        query = self.db.query(Item)

        if category_id is not None:
            query = query.filter(Item.category_id == category_id)
        if location_id is not None:
            if include_descendants:
                subtree_ids = collect_subtree_location_ids(self.db, location_id)
                query = query.filter(Item.location_id.in_(subtree_ids))
            else:
                query = query.filter(Item.location_id == location_id)
        if owner_id is not None:
            query = query.filter(Item.owner_id == owner_id)
        if statuses:
            query = query.filter(Item.status.in_(statuses))

        if search:
            search_pattern = f"%{search}%"
            query = (
                query.outerjoin(LegacyIdentifier, LegacyIdentifier.item_id == Item.id)
                .filter(
                    or_(
                        Item.name.ilike(search_pattern),
                        LegacyIdentifier.legacy_id.ilike(search_pattern),
                    )
                )
                .distinct()
            )

        total = query.count()
        items = query.order_by(Item.name).offset((page - 1) * limit).limit(limit).all()

        if not items:
            return [], total

        category_ids = {item.category_id for item in items}
        owner_ids = {item.owner_id for item in items}
        item_ids = [item.id for item in items]

        categories = {cat.id: cat for cat in self.db.query(Category).filter(Category.id.in_(category_ids)).all()}
        owners = {user.id: user for user in self.db.query(User).filter(User.id.in_(owner_ids)).all()}

        all_locations = self.db.query(Location).all()
        location_lookup = {loc.id: loc for loc in all_locations}

        legacy_rows = (
            self.db.query(LegacyIdentifier).filter(LegacyIdentifier.item_id.in_(item_ids)).all()
        )
        legacy_by_item = {row.item_id: row.legacy_id for row in legacy_rows}

        details = [
            ItemDetails(
                id=item.id,
                name=item.name,
                category=ItemCategory(
                    id=item.category_id,
                    name=categories[item.category_id].name,
                ),
                location=ItemLocation(
                    id=item.location_id,
                    path=build_location_path(item.location_id, location_lookup),
                ),
                owner=ItemOwner(
                    id=item.owner_id,
                    name=format_user_name(owners[item.owner_id]),
                ),
                description=item.description,
                status=item.status,
                legacy_id=legacy_by_item.get(item.id),
            )
            for item in items
        ]

        return details, total

    def update_item(self, item_id: int, data: ItemUpdate) -> Item:
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

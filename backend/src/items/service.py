from uuid import UUID, uuid7

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from src.categories.models import Category
from src.categories.service import build_category_path
from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.helpers import build_location_path
from src.items.models import Item, ItemHistory
from src.items.schemas import (
    ItemCategory,
    ItemCreate,
    ItemCreateResponse,
    ItemDeleteResponse,
    ItemGetResponse,
    ItemHistoryGet,
    ItemHistoryGetResponse,
    ItemLocation,
    ItemOwner,
    ItemPagination,
    ItemSearch,
    ItemSearchResponse,
    ItemsPaged,
    ItemUpdate,
    ItemUpdateResponse,
)
from src.loans.constants import LoanStatus
from src.loans.models import Loan
from src.locations.models import Location
from src.users.models import User
from src.utils import now


class ItemService:
    def __init__(self, db: Session):
        self.db = db

    def _get_item_by_uuid(self, item_id: UUID) -> Item | None:
        return self.db.execute(select(Item).where(Item.uuid == item_id)).scalar_one_or_none()

    def _owner_display_name(self, owner) -> str:
        if owner.last_name:
            return f"{owner.first_name} {owner.last_name}"
        return owner.first_name

    def add_item(self, data: ItemCreate) -> ItemCreateResponse:
        item_uuid = uuid7()

        new_item = Item(
            name=data.name,
            uuid=item_uuid,
            category_id=data.category_id,
            location_id=data.location_id,
            owner_id=data.owner_id,
            status=ItemStatus.AVAILABLE,
            description=data.description,
            parameters=data.parameters,
            oldID=data.oldID,
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

        return ItemCreateResponse(
            id=new_item.uuid,
            name=new_item.name,
            status=new_item.status,
            description=new_item.description,
            oldID=new_item.oldID,
            parameters=new_item.parameters,
            category_id=new_item.category_id,
            location_id=new_item.location_id,
            owner_id=new_item.owner_id,
        )

    def update_item(self, item_id: UUID, data: ItemUpdate) -> ItemUpdateResponse:
        item = self._get_item_by_uuid(item_id)

        if item is None:
            raise ValueError("Item not found")

        updated_at = now()

        if data.name is not None:
            item.name = data.name

        if data.category_id is not None and data.category_id != item.category_id:
            self.db.add(
                ItemHistory(
                    item_id=item.id,
                    updated_at=updated_at,
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
                    updated_at=updated_at,
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
                    updated_at=updated_at,
                    updated_by=item.owner_id,
                    change_type=ItemChangeLogType.OWNER_CHANGED,
                    description=f"Owner changed from {item.owner_id} to {data.owner_id}",
                )
            )
            item.owner_id = data.owner_id

        if data.description is not None:
            item.description = data.description

        if data.parameters is not None:
            item.parameters = data.parameters

        self.db.commit()
        self.db.refresh(item)

        return ItemUpdateResponse(
            id=item.uuid,
            name=item.name,
            description=item.description,
            category_id=item.category_id,
            location_id=item.location_id,
            owner_id=item.owner_id,
            status=item.status,
            parameters=item.parameters,
            updated_at=updated_at,
        )

    def get_item(self, item_id: UUID) -> ItemGetResponse:
        item = self.db.execute(
            select(Item)
            .where(Item.uuid == item_id)
            .options(
                selectinload(Item.category),
                selectinload(Item.location),
                selectinload(Item.owner),
            )
        ).scalar_one_or_none()

        if item is None:
            raise ValueError("Item not found")

        return ItemGetResponse(
            id=item.uuid,
            name=item.name,
            description=item.description,
            status=item.status,
            oldID=item.oldID,
            category=ItemCategory(
                id=item.category.id,
                name=item.category.name,
                path=build_category_path(item.category),
            ),
            location=ItemLocation(
                id=item.location.id,
                path=build_location_path(item.location),
            ),
            owner=ItemOwner(
                id=item.owner.id,
                name=self._owner_display_name(item.owner),
            ),
            parameters=item.parameters,
        )

    def delete_item(self, item_id: UUID) -> ItemDeleteResponse:
        item = self._get_item_by_uuid(item_id)

        if item is None:
            raise ValueError("Item not found")

        self.db.delete(item)
        self.db.commit()

        return ItemDeleteResponse(deleted=True)

    def _build_items_query(self, data: ItemSearch):
        stmt = select(Item)

        if data.search:
            q = f"%{data.search.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Item.name).like(q),
                    func.lower(func.coalesce(Item.description, "")).like(q),
                    func.lower(func.coalesce(Item.oldID, "")).like(q),
                )
            )

        if data.uuid:
            stmt = stmt.where(Item.uuid == data.uuid)

        if data.name:
            stmt = stmt.where(func.lower(Item.name).like(f"%{data.name.lower()}%"))

        if data.description:
            stmt = stmt.where(func.lower(func.coalesce(Item.description, "")).like(f"%{data.description.lower()}%"))

        if data.category_id:
            stmt = stmt.where(Item.category_id == data.category_id)

        if data.location_id:
            stmt = stmt.where(Item.location_id == data.location_id)

        if data.owner_id:
            stmt = stmt.where(Item.owner_id == data.owner_id)

        if data.borrower_id:
            loan_exists = exists().where(
                Loan.item_id == Item.id,
                Loan.status == LoanStatus.LOANED,
                or_(
                    Loan.user_id == data.borrower_id,
                    Loan.guest_id == data.borrower_id,
                ),
            )

            stmt = stmt.where(loan_exists)

        if data.status:
            stmt = stmt.where(Item.status == data.status)

        return stmt

    def search_items(self, data: ItemSearch) -> ItemsPaged:
        stmt = self._build_items_query(data)

        # liczba wszystkich wyników (bez paginacji)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.execute(count_stmt).scalar_one()

        # doładowanie relacji
        stmt = stmt.options(
            selectinload(Item.category),
            selectinload(Item.location),
            selectinload(Item.owner),
        )

        sort_field_map = {
            "id": Item.id,
            "name": Item.name,
            "status": Item.status,
            "category": Category.name,
            "location": Location.name,
            "owner": User.last_name,
        }

        if data.sort_by == "category":
            stmt = stmt.join(Item.category)
        elif data.sort_by == "location":
            stmt = stmt.join(Item.location)
        elif data.sort_by == "owner":
            stmt = stmt.join(Item.owner)

        sort_column = sort_field_map.get(data.sort_by, Item.id)

        stmt = stmt.order_by(sort_column.desc()) if data.sort_order == "desc" else stmt.order_by(sort_column.asc())

        offset = (data.page - 1) * data.limit
        stmt = stmt.offset(offset).limit(data.limit)

        results = self.db.execute(stmt).scalars().all()

        items = [
            ItemSearchResponse(
                id=item.uuid,
                name=item.name,
                status=item.status,
                oldID=item.oldID,
                category=ItemCategory(
                    id=item.category.id,
                    name=item.category.name,
                    path=build_category_path(item.category),                    
                )
                if item.category
                else None,
                location=ItemLocation(
                    id=item.location.id,
                    path=build_location_path(item.location),
                )
                if item.location
                else None,
                owner=ItemOwner(
                    id=item.owner.id,
                    name=self._owner_display_name(item.owner),
                )
                if item.owner
                else None,
                description=item.description,
            )
            for item in results
        ]

        return ItemsPaged(
            items=items,
            pagination=ItemPagination(
                page=data.page,
                limit=data.limit,
                total=total,
            ),
        )

    def get_item_history(self, item_id: UUID) -> ItemHistoryGetResponse:
        item = self._get_item_by_uuid(item_id)

        if item is None:
            raise ValueError("Item not found")

        stmt = select(ItemHistory).where(ItemHistory.item_id == item.id).order_by(ItemHistory.updated_at.desc())

        results = self.db.execute(stmt).scalars().all()
        return ItemHistoryGetResponse(
            entries=[
                ItemHistoryGet(
                    id=entry.id,
                    updated_at=entry.updated_at,
                    updated_by=entry.updated_by,
                    change_type=entry.change_type,
                    description=entry.description,
                )
                for entry in results
            ]
        )

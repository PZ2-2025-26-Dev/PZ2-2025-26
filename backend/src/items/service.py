from uuid import UUID, uuid7

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from src.categories.models import Category
from src.categories.service import build_category_path
from src.items.constants import BASIC_LENGTH, ItemChangeLogType, ItemStatus
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
    ItemHistorySearch,
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


class InvalidScanCodeError(ValueError):
    pass


class ItemService:
    def __init__(self, db: Session):
        self.db = db

    def _get_item_by_uuid(self, item_id: UUID) -> Item | None:
        return self.db.execute(select(Item).where(Item.uuid == item_id)).scalar_one_or_none()

    def _get_item_by_uuid_with_relations(self, item_id: UUID) -> Item | None:
        return self.db.execute(
            select(Item)
            .where(Item.uuid == item_id)
            .options(
                selectinload(Item.category),
                selectinload(Item.location),
                selectinload(Item.owner),
            )
        ).scalar_one_or_none()

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
        item = self._get_item_by_uuid_with_relations(item_id)

        if item is None:
            raise ValueError("Item not found")

        return self.to_get_response(item)

    def get_item_for_label(self, item_id: UUID) -> Item:
        item = self._get_item_by_uuid_with_relations(item_id)

        if item is None:
            raise ValueError("Item not found")

        return item

    def get_item_by_scan_code(self, code: str) -> ItemGetResponse:
        if not code.strip() or len(code) > BASIC_LENGTH:
            raise InvalidScanCodeError("Invalid QR code")

        try:
            item_uuid = UUID(code)
        except ValueError:
            criterion = Item.oldID == code
        else:
            if code != str(item_uuid):
                raise InvalidScanCodeError("Invalid QR code")
            criterion = Item.uuid == item_uuid

        item = self.db.execute(
            select(Item)
            .where(criterion)
            .options(
                selectinload(Item.category),
                selectinload(Item.location),
                selectinload(Item.owner),
            )
        ).scalar_one_or_none()

        if item is None:
            raise ValueError("Item not found")

        return self.to_get_response(item)

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
                Loan.status == LoanStatus.ACTIVE,
                or_(
                    Loan.user_id == data.borrower_id,
                    Loan.guest_id == data.borrower_id,
                ),
            )
            stmt = stmt.where(loan_exists)

        if data.status:
            stmt = stmt.where(Item.status == data.status)

        if data.custom_params:
            pairs = data.custom_params.split(",")
            for pair in pairs:
                if ":" in pair:
                    key, value = pair.split(":", 1)
                    key = key.strip()
                    value = value.strip()
                    
                    if value and value.lower() != "all":
                        q = f"%{value.lower()}%"
                        stmt = stmt.where(func.lower(Item.parameters[key].as_string()).like(q))

        return stmt

    def search_items(self, data: ItemSearch) -> ItemsPaged:
        stmt = self._build_items_query(data)

        # liczba wszystkich wyników (bez paginacji)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.execute(count_stmt).scalar_one()

        # doładowanie podstawowych relacji
        stmt = stmt.options(
            selectinload(Item.category),
            selectinload(Item.location),
            selectinload(Item.owner),
        )

        # Mapa pól sortowania na kolumny bazodanowe
        sort_field_map = {
            "id": Item.id,
            "name": Item.name,
            "status": Item.status,
            "category": Category.name,
            "location": Location.name,
            "owner": User.last_name,
        }

        sort_criterias = []
        if data.sort:
            parts = data.sort.split(",")
            for part in parts:
                if ":" in part:
                    field, order = part.split(":", 1)
                else:
                    field, order = part, "asc"
                
                field = field.strip().lower()
                order = order.strip().lower()
                if field in sort_field_map:
                    sort_criterias.append((field, order))

        joined_tables = set()
        for field, _ in sort_criterias:
            if field == "category" and "category" not in joined_tables:
                stmt = stmt.join(Item.category, isouter=True)
                joined_tables.add("category")
            elif field == "location" and "location" not in joined_tables:
                stmt = stmt.join(Item.location, isouter=True)
                joined_tables.add("location")
            elif field == "owner" and "owner" not in joined_tables:
                stmt = stmt.join(Item.owner, isouter=True)
                joined_tables.add("owner")

        order_by_clauses = []
        for field, order in sort_criterias:
            if field == "borrower":
                column = User.last_name
            elif field == "duedate":
                column = Loan.declared_return_date 
            else:
                column = sort_field_map.get(field, Item.id)

            if order == "desc":
                order_by_clauses.append(column.desc())
            else:
                order_by_clauses.append(column.asc())

        if not order_by_clauses:
            order_by_clauses.append(Item.id.desc())

        stmt = stmt.order_by(*order_by_clauses)

        offset = (data.page - 1) * data.limit
        stmt = stmt.offset(offset).limit(data.limit)

        results = self.db.execute(stmt).scalars().all()

        items = []
        for item in results:
            # Zamiast selectinload(Loan.user) robimy ręczny, bezpieczny JOIN z tabelą User
            loan_data = self.db.execute(
                select(Loan, User)
                .join(User, Loan.user_id == User.id, isouter=True)
                .where(Loan.item_id == item.id, Loan.status == LoanStatus.ACTIVE)
            ).first()

            borrower_name = None
            due_date_str = None
            
            if loan_data:
                loan_obj, user_obj = loan_data
                
                if user_obj:
                    borrower_name = f"{user_obj.first_name} {user_obj.last_name}".strip()
                elif getattr(loan_obj, 'guest_id', None):
                    borrower_name = f"Gość #{loan_obj.guest_id}"
                
                # Bezpieczne pobieranie daty z obiektu wypożyczenia
                due_date_val = getattr(loan_obj, 'due_date', None) or getattr(loan_obj, 'declared_return_date', None)
                if due_date_val:
                    due_date_str = due_date_val.strftime("%Y-%m-%d")

            items.append(
                ItemSearchResponse(
                    id=item.uuid,
                    name=item.name,
                    status=item.status,
                    oldID=item.oldID,
                    category=ItemCategory(
                        id=item.category.id,
                        name=item.category.name,
                        path=build_category_path(item.category),
                    ) if item.category else None,
                    location=ItemLocation(
                        id=item.location.id,
                        path=build_location_path(item.location),
                    ) if item.location else None,
                    owner=ItemOwner(
                        id=item.owner.id,
                        name=self._owner_display_name(item.owner),
                    ) if item.owner else None,
                    description=item.description,
                    borrower=borrower_name,
                    dueDate=due_date_str
                )
            )

        return ItemsPaged(
            items=items,
            pagination=ItemPagination(
                page=data.page,
                limit=data.limit,
                total=total,
            ),
        )

    def get_item_history(self, item_id: UUID, data: ItemHistorySearch) -> ItemHistoryGetResponse:
        item = self._get_item_by_uuid(item_id)

        if item is None:
            raise ValueError("Item not found")

        conditions = [ItemHistory.item_id == item.id]
        if data.change_type is not None:
            conditions.append(ItemHistory.change_type == data.change_type)

        total = self.db.scalar(select(func.count(ItemHistory.id)).where(*conditions)) or 0
        stmt = (
            select(ItemHistory)
            .where(*conditions)
            .order_by(ItemHistory.updated_at.desc(), ItemHistory.id.desc())
            .offset((data.page - 1) * data.limit)
            .limit(data.limit)
        )

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
            ],
            pagination=ItemPagination(page=data.page, limit=data.limit, total=total),
        )

    def to_get_response(self, item: Item) -> ItemGetResponse:
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
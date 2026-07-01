from io import BytesIO

from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.items.models import Category, Item
from src.items.schemas import ItemSearch
from src.items.service import ItemService
from src.locations.models import Location
from src.users.models import User


class ExportService:
    def __init__(self, db):
        self.db = db

    def get_items(
        self,
        search: str | None = None,
        status: str | None = None,
        category: str | None = None,
    ):
        stmt = select(Item).order_by(Item.id)

        if status:
            stmt = stmt.where(Item.status == status)

        if category:
            stmt = stmt.where(Item.category.has(name=category))

        if search:
            like = f"%{search}%"
            stmt = stmt.where((Item.name.ilike(like)) | (Item.description.ilike(like)))

        return self.db.execute(stmt).scalars().all()

    def export_items_xlsx(self, data: ItemSearch):
        stmt = ItemService(self.db)._build_items_query(data)
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

        # Parse multiple sort criteria: "name:asc,status:desc,category:asc"
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

        # Apply joins for related fields if needed
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

        # Build order_by clauses for all sort criteria
        order_by_clauses = []
        for field, order in sort_criterias:
            column = sort_field_map.get(field, Item.id)
            if order == "desc":
                order_by_clauses.append(column.desc())
            else:
                order_by_clauses.append(column.asc())

        # If no sort criteria specified, default to name ascending
        if not order_by_clauses:
            order_by_clauses.append(Item.name.asc())

        stmt = stmt.order_by(*order_by_clauses)

        items = self.db.execute(stmt).scalars().all()

        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Items"

        worksheet.append(
            [
                "ID",
                "Name",
                "Inventory Number",
                "Category",
                "Location",
                "Owner",
                "Status",
                "Description",
            ]
        )

        for item in items:
            worksheet.append(
                [
                    item.id,
                    item.name,
                    item.oldID or "",
                    item.category.name if item.category else "",
                    item.location.name if item.location else "",
                    f"{item.owner.first_name} {item.owner.last_name}".strip() if item.owner else "",
                    item.status.value,
                    item.description or "",
                ]
            )

        stream = BytesIO()
        workbook.save(stream)
        stream.seek(0)

        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": 'attachment; filename="items.xlsx"',
            },
        )

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

        sort_by = "name"
        sort_order = "asc"

        if data.sort and ":" in data.sort:
            sort_by, sort_order = data.sort.split(":", 1)
        elif data.sort:
            sort_by = data.sort

        sort_field_map = {
            "id": Item.id,
            "name": Item.name,
            "status": Item.status,
            "category": Category.name,
            "location": Location.name,
            "owner": User.last_name,
        }

        if sort_by == "category":
            stmt = stmt.join(Item.category)
        elif sort_by == "location":
            stmt = stmt.join(Item.location)
        elif sort_by == "owner":
            stmt = stmt.join(Item.owner)

        sort_column = sort_field_map.get(sort_by, Item.id)

        stmt = stmt.order_by(sort_column.desc()) if sort_order == "desc" else stmt.order_by(sort_column.asc())

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
                    item.owner.first_name if item.owner else "",
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

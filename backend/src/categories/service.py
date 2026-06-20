from sqlalchemy import Select, func, select, update
from sqlalchemy.orm import Session

from src.categories.exceptions import (
    CategoryDuplicateNameError,
    CategoryHasChildrenError,
    CategoryNotFoundError,
    CategoryParentCycleError,
    CategoryReplacementError,
)
from src.categories.models import Category
from src.categories.schemas import (
    CategoryCreate,
    CategoryItem,
    CategoryResponse,
    CategoryUpdate,
)
from src.items.models import Item


def build_category_path(category: Category) -> str:
    """Build a public display path for a category hierarchy."""
    names: list[str] = []
    visited_keys: set[int] = set()
    current: Category | None = category

    while current is not None:
        category_key = current.id if current.id is not None else id(current)
        if category_key in visited_keys:
            raise ValueError("Category hierarchy contains a cycle")

        visited_keys.add(category_key)
        names.append(current.name)
        current = current.parent

    return " / ".join(reversed(names))


class CategoryService:
    def __init__(self, db: Session):
        self.db = db

    def create_category(self, data: CategoryCreate) -> Category:
        if data.parent_id is not None:
            self._get_category_or_raise(data.parent_id)
        self._ensure_unique_name(name=data.name, parent_id=data.parent_id)

        category = Category(name=data.name, parent_id=data.parent_id)
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def update_category(self, category_id: int, data: CategoryUpdate) -> Category:
        category = self._get_category_or_raise(category_id)

        next_name = data.name
        next_parent_id = data.parent_id

        if next_parent_id == category_id:
            raise CategoryParentCycleError("Category cannot be its own parent")
        if next_parent_id is not None:
            self._get_category_or_raise(next_parent_id)
            self._ensure_parent_is_not_descendant(category_id=category_id, parent_id=next_parent_id)

        if next_name != category.name or next_parent_id != category.parent_id:
            self._ensure_unique_name(name=next_name, parent_id=next_parent_id, ignored_category_id=category_id)

        category.name = next_name
        category.parent_id = next_parent_id
        self.db.commit()
        self.db.refresh(category)
        return category

    def delete_category(self, category_id: int, replacement_category_id: int) -> int:
        category = self._get_category_or_raise(category_id)
        if category_id == replacement_category_id:
            raise CategoryReplacementError("Replacement category must be different from deleted category")

        self._get_category_or_raise(replacement_category_id)

        children_count = self.db.scalar(
            select(func.count()).select_from(Category).where(Category.parent_id == category_id)
        )
        if children_count:
            raise CategoryHasChildrenError("Category has child categories")

        item_count = self.count_category_items(category_id)
        self.db.execute(update(Item).where(Item.category_id == category_id).values(category_id=replacement_category_id))
        self.db.delete(category)
        self.db.commit()
        return item_count

    def list_categories(self, page: int, limit: int) -> tuple[list[CategoryResponse], int]:
        total = self.db.scalar(select(func.count()).select_from(Category)) or 0
        stmt = select(Category).order_by(Category.name.asc(), Category.id.asc()).offset((page - 1) * limit).limit(limit)
        categories = self.db.execute(stmt).scalars().all()
        return [self.to_response(category) for category in categories], total

    def get_category_items(self, category_id: int, page: int, limit: int) -> tuple[list[CategoryItem], int]:
        self._get_category_or_raise(category_id)

        total = self.count_category_items(category_id)
        stmt = (
            select(Item)
            .where(Item.category_id == category_id)
            .order_by(Item.name.asc(), Item.id.asc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        items = self.db.execute(stmt).scalars().all()
        return [
            CategoryItem(
                id=item.id,
                name=item.name,
                status=item.status.value,
                description=item.description,
            )
            for item in items
        ], total

    def get_category_items_count(self, category_id: int) -> int:
        self._get_category_or_raise(category_id)
        return self.count_category_items(category_id)

    def count_category_items(self, category_id: int) -> int:
        return self.db.scalar(select(func.count()).select_from(Item).where(Item.category_id == category_id)) or 0

    def to_response(self, category: Category) -> CategoryResponse:
        return CategoryResponse(
            id=category.id,
            name=category.name,
            parent_id=category.parent_id,
            path=build_category_path(category),
        )

    def _get_category_or_raise(self, category_id: int) -> Category:
        category = self.db.get(Category, category_id)
        if category is None:
            raise CategoryNotFoundError("Category not found")
        return category

    def _ensure_unique_name(
        self,
        *,
        name: str,
        parent_id: int | None,
        ignored_category_id: int | None = None,
    ) -> None:
        stmt: Select[tuple[Category]] = select(Category).where(Category.name == name)
        if parent_id is None:
            stmt = stmt.where(Category.parent_id.is_(None))
        else:
            stmt = stmt.where(Category.parent_id == parent_id)
        if ignored_category_id is not None:
            stmt = stmt.where(Category.id != ignored_category_id)

        if self.db.scalar(stmt) is not None:
            raise CategoryDuplicateNameError("Category name already exists under this parent")

    def _ensure_parent_is_not_descendant(self, *, category_id: int, parent_id: int) -> None:
        current = self.db.get(Category, parent_id)
        while current is not None:
            if current.id == category_id:
                raise CategoryParentCycleError("Parent category cannot be a descendant")
            current = current.parent

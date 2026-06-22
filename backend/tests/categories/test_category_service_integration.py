import pytest
from sqlalchemy.orm import Session

from src.categories.exceptions import (
    CategoryDuplicateNameError,
    CategoryNotFoundError,
    CategoryParentCycleError,
    CategoryReplacementError,
)
from src.categories.models import Category
from src.categories.schemas import CategoryCreate, CategoryUpdate
from src.categories.service import CategoryService
from src.items.models import Item
from src.seed import SEED_IDS

pytestmark = pytest.mark.integration


def test_create_category_persists_child_and_builds_path(seeded_db: Session):
    service = CategoryService(seeded_db)

    category = service.create_category(CategoryCreate(name="Telefony", parent_id=SEED_IDS.electronics))

    assert category.id is not None
    assert category.parent_id == SEED_IDS.electronics
    assert service.to_response(category).path == "Elektronika / Telefony"


def test_create_category_rejects_duplicate_sibling_name(seeded_db: Session):
    service = CategoryService(seeded_db)

    with pytest.raises(CategoryDuplicateNameError):
        service.create_category(CategoryCreate(name="Elektronika"))


def test_create_category_rejects_missing_parent(seeded_db: Session):
    service = CategoryService(seeded_db)

    with pytest.raises(CategoryNotFoundError):
        service.create_category(CategoryCreate(name="Telefony", parent_id=999999))


def test_update_category_changes_name_and_parent(seeded_db: Session):
    service = CategoryService(seeded_db)
    category = service.create_category(CategoryCreate(name="Telefony", parent_id=SEED_IDS.electronics))

    updated = service.update_category(category.id, CategoryUpdate(name="Sprzet mobilny", parent_id=None))

    assert updated.name == "Sprzet mobilny"
    assert updated.parent_id is None
    assert service.to_response(updated).path == "Sprzet mobilny"


def test_update_category_rejects_parent_cycle(seeded_db: Session):
    service = CategoryService(seeded_db)

    with pytest.raises(CategoryParentCycleError):
        service.update_category(
            SEED_IDS.electronics,
            CategoryUpdate(name="Elektronika", parent_id=SEED_IDS.computers),
        )


def test_update_category_rejects_duplicate_name_after_move(seeded_db: Session):
    service = CategoryService(seeded_db)
    phones = service.create_category(CategoryCreate(name="Telefony", parent_id=None))
    service.create_category(CategoryCreate(name="Telefony", parent_id=SEED_IDS.electronics))

    with pytest.raises(CategoryDuplicateNameError):
        service.update_category(
            phones.id,
            CategoryUpdate(name="Telefony", parent_id=SEED_IDS.electronics),
        )


def test_delete_category_reassigns_items_to_replacement_category(seeded_db: Session):
    service = CategoryService(seeded_db)

    moved_count = service.delete_category(SEED_IDS.accessories, SEED_IDS.electronics)

    assert moved_count == 1
    assert seeded_db.get(Category, SEED_IDS.accessories) is None
    assert seeded_db.get(Item, SEED_IDS.adapter).category_id == SEED_IDS.electronics


def test_delete_category_removes_subcategories_and_reassigns_their_items(seeded_db: Session):
    service = CategoryService(seeded_db)
    replacement = service.create_category(CategoryCreate(name="Archiwum", parent_id=None))

    moved_count = service.delete_category(SEED_IDS.electronics, replacement.id)

    assert moved_count == 3
    assert seeded_db.get(Category, SEED_IDS.electronics) is None
    assert seeded_db.get(Category, SEED_IDS.computers) is None
    assert seeded_db.get(Category, SEED_IDS.accessories) is None
    assert seeded_db.get(Item, SEED_IDS.projector).category_id == replacement.id
    assert seeded_db.get(Item, SEED_IDS.laptop).category_id == replacement.id
    assert seeded_db.get(Item, SEED_IDS.adapter).category_id == replacement.id


def test_delete_category_rejects_replacement_from_deleted_tree(seeded_db: Session):
    service = CategoryService(seeded_db)

    with pytest.raises(CategoryReplacementError):
        service.delete_category(SEED_IDS.electronics, SEED_IDS.computers)


def test_delete_category_rejects_same_replacement_category(seeded_db: Session):
    service = CategoryService(seeded_db)

    with pytest.raises(CategoryReplacementError):
        service.delete_category(SEED_IDS.accessories, SEED_IDS.accessories)


def test_delete_empty_category_returns_zero_moved_items(seeded_db: Session):
    service = CategoryService(seeded_db)
    category = service.create_category(CategoryCreate(name="Pusta kategoria", parent_id=None))

    moved_count = service.delete_category(category.id, SEED_IDS.electronics)

    assert moved_count == 0
    assert seeded_db.get(Category, category.id) is None


def test_list_categories_returns_paged_results(seeded_db: Session):
    service = CategoryService(seeded_db)

    categories, total = service.list_categories(page=1, limit=2)

    assert total >= 3
    assert len(categories) == 2
    assert all(category.path for category in categories)


def test_get_category_items_and_count_use_direct_category(seeded_db: Session):
    service = CategoryService(seeded_db)

    items, total = service.get_category_items(SEED_IDS.electronics, page=1, limit=10)

    assert total == 1
    assert service.count_category_items(SEED_IDS.electronics) == 1
    assert [item.name for item in items] == ["Projektor"]


def test_get_category_items_rejects_missing_category(seeded_db: Session):
    service = CategoryService(seeded_db)

    with pytest.raises(CategoryNotFoundError):
        service.get_category_items(999999, page=1, limit=10)

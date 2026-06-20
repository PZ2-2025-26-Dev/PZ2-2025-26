import pytest
from pydantic import ValidationError

from src.categories.constants import CATEGORY_NAME_LENGTH, CATEGORY_PAGE_LIMIT_MAX
from src.categories.schemas import CategoryCreate, CategoryPagination, CategoryResponse, CategoryUpdate


def test_category_create_accepts_valid_parentless_category():
    data = CategoryCreate(name="Elektronika")

    assert data.name == "Elektronika"
    assert data.parent_id is None


def test_category_create_rejects_empty_name():
    with pytest.raises(ValidationError):
        CategoryCreate(name="")


def test_category_create_rejects_too_long_name():
    with pytest.raises(ValidationError):
        CategoryCreate(name="x" * (CATEGORY_NAME_LENGTH + 1))


def test_category_pagination_rejects_limit_above_public_contract():
    with pytest.raises(ValidationError):
        CategoryPagination(page=1, limit=CATEGORY_PAGE_LIMIT_MAX + 1, total=0)


def test_category_update_requires_name_for_put_contract():
    with pytest.raises(ValidationError):
        CategoryUpdate(parent_id=None)


def test_category_update_accepts_parentless_category():
    data = CategoryUpdate(name="Elektronika", parent_id=None)

    assert data.name == "Elektronika"
    assert data.parent_id is None


def test_category_response_accepts_public_path():
    response = CategoryResponse(id=1, name="Telefony", parent_id=2, path="Elektronika / Telefony")

    assert response.path == "Elektronika / Telefony"

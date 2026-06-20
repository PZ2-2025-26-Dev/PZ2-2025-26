import pytest

from src.categories.models import Category
from src.categories.service import build_category_path


def test_build_category_path_for_nested_category():
    root = Category(id=1, name="Elektronika", parent_id=None)
    child = Category(id=2, name="Telefony", parent_id=1, parent=root)
    grandchild = Category(id=3, name="Smartfony", parent_id=2, parent=child)

    assert build_category_path(grandchild) == "Elektronika / Telefony / Smartfony"


def test_build_category_path_for_root_category():
    category = Category(id=1, name="Elektronika", parent_id=None)

    assert build_category_path(category) == "Elektronika"


def test_build_category_path_for_unsaved_category_tree():
    root = Category(name="Elektronika", parent_id=None)
    child = Category(name="Telefony", parent=root)

    assert build_category_path(child) == "Elektronika / Telefony"


def test_build_category_path_detects_cycle():
    root = Category(id=1, name="Elektronika", parent_id=None)
    child = Category(id=2, name="Telefony", parent_id=1, parent=root)
    root.parent = child

    with pytest.raises(ValueError, match="cycle"):
        build_category_path(child)

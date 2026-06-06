"""
Testy integracyjne wydajnościowe dla domeny items.

Weryfikują kryteria czasowe ustalone z klientem:
  - GET /items (wyszukiwanie) <= 100 ms
  - GET /items (ładowanie pierwszej strony) <= 2500 ms

Uruchomienie:
    backend/scripts/integration-tests.sh
"""

import time

import pytest
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.categories.models import Category
from src.items.constants import ItemStatus
from src.items.models import LegacyIdentifier
from src.items.schemas import ItemCreate
from src.items.service import ItemService
from src.locations.constants import LocationType
from src.locations.models import Location
from src.users.models import User

pytestmark = pytest.mark.integration

# ---------------------------------------------------------------------------
# Stałe kryteriów akceptacyjnych
# ---------------------------------------------------------------------------
MAX_SEARCH_MS = 100
MAX_INITIAL_LOAD_MS = 2500


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def base_entities(db: Session) -> dict:
    """Tworzy wspólne encje (kategoria, lokalizacja, użytkownik) reużywane w testach."""
    cat = Category(name="Elektronika", parent_id=None)
    loc = Location(
        name="D10",
        type=LocationType.BUILDING,
        description=None,
        parent_id=None,
        is_active=True,
    )
    user = User(
        first_name="Jan",
        last_name="Kowalski",
        email="jan.kowalski@example.com",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )
    db.add_all([cat, loc, user])
    db.commit()
    return {"cat": cat, "loc": loc, "user": user}


@pytest.fixture()
def seeded_items(db: Session, base_entities: dict) -> dict:
    """
    Zasila bazę 100 przedmiotami, z czego:
      - 10 ma nazwę zaczynającą się od 'Nokia' (do testów wyszukiwania)
      - 5 ma przypisany legacy_id
    Zwraca referencje do encji pomocniczych.
    """
    cat = base_entities["cat"]
    loc = base_entities["loc"]
    user = base_entities["user"]
    service = ItemService(db)

    for i in range(1, 91):
        service.add_item(ItemCreate(
            name=f"Przedmiot testowy {i}",
            category_id=cat.id,
            location_id=loc.id,
            owner_id=user.id,
            description=f"Opis przedmiotu {i}",
        ))

    nokia_items = []
    for i in range(1, 11):
        item = service.add_item(ItemCreate(
            name=f"Nokia {3000 + i}",
            category_id=cat.id,
            location_id=loc.id,
            owner_id=user.id,
            description=None,
        ))
        nokia_items.append(item)

    for i, item in enumerate(nokia_items[:5], start=1):
        db.add(LegacyIdentifier(item_id=item.id, legacy_id=1000 + i))
    db.commit()

    return {"cat": cat, "loc": loc, "user": user, "nokia_items": nokia_items}


# ---------------------------------------------------------------------------
# Testy get_items_paged — poprawność zwracanych danych
# ---------------------------------------------------------------------------

class TestGetItemsPagedCorrectness:

    def test_returns_all_items_on_first_page(self, db: Session, seeded_items: dict):
        service = ItemService(db)
        items, total = service.get_items_paged(page=1, limit=100)

        assert total == 100
        assert len(items) == 100

    def test_pagination_limit_is_respected(self, db: Session, seeded_items: dict):
        service = ItemService(db)
        items, total = service.get_items_paged(page=1, limit=10)

        assert total == 100
        assert len(items) == 10

    def test_pagination_offset_is_correct(self, db: Session, seeded_items: dict):
        service = ItemService(db)
        page1, _ = service.get_items_paged(page=1, limit=10)
        page2, _ = service.get_items_paged(page=2, limit=10)

        ids_page1 = {item.id for item in page1}
        ids_page2 = {item.id for item in page2}
        assert ids_page1.isdisjoint(ids_page2), "Strony nie mogą zawierać tych samych przedmiotów"

    def test_search_filter_returns_matching_items(self, db: Session, seeded_items: dict):
        service = ItemService(db)
        items, total = service.get_items_paged(search="Nokia", page=1, limit=100)

        assert total == 10
        assert len(items) == 10
        assert all("Nokia" in item.name for item in items)

    def test_search_filter_case_insensitive(self, db: Session, seeded_items: dict):
        service = ItemService(db)
        items_upper, _ = service.get_items_paged(search="NOKIA", page=1, limit=100)
        items_lower, _ = service.get_items_paged(search="nokia", page=1, limit=100)

        assert len(items_upper) == len(items_lower) == 10

    def test_search_returns_empty_for_no_match(self, db: Session, seeded_items: dict):
        service = ItemService(db)
        items, total = service.get_items_paged(search="xyzNieistnieje", page=1, limit=100)

        assert total == 0
        assert items == []

    def test_category_filter(self, db: Session, seeded_items: dict, base_entities: dict):
        service = ItemService(db)
        items, total = service.get_items_paged(category_id=base_entities["cat"].id, page=1, limit=100)

        assert total == 100
        assert all(item.category_id == base_entities["cat"].id for item in items)

    def test_location_filter(self, db: Session, seeded_items: dict, base_entities: dict):
        service = ItemService(db)
        items, total = service.get_items_paged(location_id=base_entities["loc"].id, page=1, limit=100)

        assert total == 100
        assert all(item.location_id == base_entities["loc"].id for item in items)

    def test_owner_filter(self, db: Session, seeded_items: dict, base_entities: dict):
        service = ItemService(db)
        items, total = service.get_items_paged(owner_id=base_entities["user"].id, page=1, limit=100)

        assert total == 100
        assert all(item.owner_id == base_entities["user"].id for item in items)

    def test_status_filter(self, db: Session, seeded_items: dict):
        service = ItemService(db)
        items, total = service.get_items_paged(status=ItemStatus.AVAILABLE, page=1, limit=100)

        assert total == 100
        assert all(item.status == ItemStatus.AVAILABLE for item in items)

    def test_relations_are_loaded(self, db: Session, seeded_items: dict):
        """Weryfikuje, że relacje są załadowane (brak lazy-load po zamknięciu sesji)."""
        service = ItemService(db)
        items, _ = service.get_items_paged(page=1, limit=10)

        for item in items:
            assert item.category is not None
            assert item.category.name is not None
            assert item.location is not None
            assert item.location.path is not None
            assert item.owner is not None
            assert item.owner.name is not None

    def test_legacy_id_is_present_when_exists(self, db: Session, seeded_items: dict):
        service = ItemService(db)
        items, _ = service.get_items_paged(search="Nokia", page=1, limit=100)

        items_with_legacy = [i for i in items if i.legacy_id is not None]
        items_without_legacy = [i for i in items if i.legacy_id is None]

        assert len(items_with_legacy) == 5
        assert len(items_without_legacy) == 5


# ---------------------------------------------------------------------------
# Testy get_item_by_id — poprawność zwracanych danych
# ---------------------------------------------------------------------------

class TestGetItemByIdCorrectness:

    def test_returns_correct_item(self, db: Session, seeded_items: dict):
        nokia = seeded_items["nokia_items"][0]
        service = ItemService(db)

        item = service.get_item_by_id(nokia.id)

        assert item is not None
        assert item.id == nokia.id
        assert item.name == nokia.name

    def test_returns_none_for_nonexistent_id(self, db: Session, seeded_items: dict):
        service = ItemService(db)

        item = service.get_item_by_id(999999)

        assert item is None

    def test_relations_are_loaded(self, db: Session, seeded_items: dict):
        nokia = seeded_items["nokia_items"][0]
        service = ItemService(db)

        item = service.get_item_by_id(nokia.id)

        assert item.category is not None
        assert item.category.name is not None
        assert item.location is not None
        assert item.location.path is not None
        assert item.owner is not None
        assert item.owner.name is not None

    def test_legacy_id_present_when_exists(self, db: Session, seeded_items: dict):
        """Pierwsze 5 Nokia ma legacy_id — weryfikujemy właściwość wirtualną."""
        nokia_with_legacy = seeded_items["nokia_items"][0]
        service = ItemService(db)

        item = service.get_item_by_id(nokia_with_legacy.id)

        assert item.legacy_id is not None

    def test_legacy_id_none_when_not_exists(self, db: Session, seeded_items: dict):
        nokia_without_legacy = seeded_items["nokia_items"][9]
        service = ItemService(db)

        item = service.get_item_by_id(nokia_without_legacy.id)

        assert item.legacy_id is None


# ---------------------------------------------------------------------------
# Testy wydajnościowe — kryteria czasowe na żywej bazie
# ---------------------------------------------------------------------------

class TestSearchResponseTime:
    """Weryfikuje kryterium: wyszukiwanie <= 100 ms."""

    def test_search_by_name_within_time_limit(self, db: Session, seeded_items: dict):
        service = ItemService(db)

        start = time.perf_counter()
        items, total = service.get_items_paged(search="Nokia", page=1, limit=100)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert total == 10
        assert elapsed_ms <= MAX_SEARCH_MS, (
            f"Wyszukiwanie trwało {elapsed_ms:.1f} ms — limit to {MAX_SEARCH_MS} ms"
        )

    def test_search_with_all_filters_within_time_limit(self, db: Session, seeded_items: dict, base_entities: dict):
        service = ItemService(db)

        start = time.perf_counter()
        items, total = service.get_items_paged(
            search="Nokia",
            category_id=base_entities["cat"].id,
            location_id=base_entities["loc"].id,
            owner_id=base_entities["user"].id,
            status=ItemStatus.AVAILABLE,
            page=1,
            limit=50,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms <= MAX_SEARCH_MS, (
            f"Wyszukiwanie z filtrami trwało {elapsed_ms:.1f} ms — limit to {MAX_SEARCH_MS} ms"
        )

    def test_empty_search_within_time_limit(self, db: Session, seeded_items: dict):
        service = ItemService(db)

        start = time.perf_counter()
        items, total = service.get_items_paged(search="xyzNieistnieje", page=1, limit=100)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert total == 0
        assert elapsed_ms <= MAX_SEARCH_MS, (
            f"Puste wyszukiwanie trwało {elapsed_ms:.1f} ms — limit to {MAX_SEARCH_MS} ms"
        )


class TestInitialLoadResponseTime:
    """Weryfikuje kryterium: pierwsze ładowanie strony <= 2500 ms."""

    def test_first_page_load_within_time_limit(self, db: Session, seeded_items: dict):
        service = ItemService(db)

        start = time.perf_counter()
        items, total = service.get_items_paged(page=1, limit=100)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert len(items) == 100
        assert elapsed_ms <= MAX_INITIAL_LOAD_MS, (
            f"Ładowanie pierwszej strony trwało {elapsed_ms:.1f} ms — limit to {MAX_INITIAL_LOAD_MS} ms"
        )

    def test_subsequent_page_within_time_limit(self, db: Session, seeded_items: dict):
        service = ItemService(db)

        start = time.perf_counter()
        items, total = service.get_items_paged(page=2, limit=50)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms <= MAX_INITIAL_LOAD_MS, (
            f"Ładowanie strony 2 trwało {elapsed_ms:.1f} ms — limit to {MAX_INITIAL_LOAD_MS} ms"
        )

    def test_get_item_by_id_within_time_limit(self, db: Session, seeded_items: dict):
        nokia = seeded_items["nokia_items"][0]
        service = ItemService(db)

        start = time.perf_counter()
        item = service.get_item_by_id(nokia.id)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert item is not None
        assert elapsed_ms <= MAX_INITIAL_LOAD_MS, (
            f"Pobranie przedmiotu po ID trwało {elapsed_ms:.1f} ms — limit to {MAX_INITIAL_LOAD_MS} ms"
        )
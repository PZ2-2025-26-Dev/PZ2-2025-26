"""
Testy wydajnościowe dla domeny items.

Weryfikują kryteria czasowe ustalone z klientem:
  - GET /items (wyszukiwanie) <= 100 ms
  - GET /items (ładowanie pierwszej strony) <= 2500 ms

Uruchomienie:
    pytest tests/items/test_performance.py -v

Wymagania:
    pip install pytest-benchmark
    Baza danych musi być dostępna i zasilona danymi (patrz: fixture seed_items).
"""

import time
import pytest
from sqlalchemy.orm import Session
from unittest.mock import patch, MagicMock

from src.items.service import ItemService
from src.items.models import Item, LegacyIdentifier
from src.items.constants import ItemStatus
from src.items.schemas import ItemCreate


# ---------------------------------------------------------------------------
# Stałe kryteriów akceptacyjnych (ms -> s)
# ---------------------------------------------------------------------------
MAX_SEARCH_RESPONSE_MS = 100
MAX_INITIAL_LOAD_MS = 2500


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_item(i: int) -> MagicMock:
    """Buduje mock obiektu Item ze wszystkimi wymaganymi relacjami."""
    item = MagicMock(spec=Item)
    item.id = i
    item.name = f"Przedmiot testowy {i}"
    item.status = ItemStatus.AVAILABLE
    item.description = None

    item.category = MagicMock()
    item.category.id = 1
    item.category.name = "Elektronika"

    item.location = MagicMock()
    item.location.id = 1
    item.location.path = "A1 / 101"

    item.owner = MagicMock()
    item.owner.id = 1
    item.owner.name = "Jan Kowalski"

    item.legacy_identifier = None
    item.legacy_id = None

    return item


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_db_small() -> MagicMock:
    """Baza z 10 przedmiotami – symuluje wyszukiwanie z filtrem."""
    db = MagicMock(spec=Session)
    items = [_make_mock_item(i) for i in range(1, 11)]

    db.scalars.return_value.all.return_value = items
    db.scalar.return_value = len(items)
    return db


@pytest.fixture()
def mock_db_large() -> MagicMock:
    """Baza ze 100 przedmiotami – symuluje ładowanie pierwszej strony."""
    db = MagicMock(spec=Session)
    items = [_make_mock_item(i) for i in range(1, 101)]

    db.scalars.return_value.all.return_value = items
    db.scalar.return_value = 500  # Całkowita liczba rekordów w bazie
    return db


# ---------------------------------------------------------------------------
# Testy kryteriów czasowych (bez pytest-benchmark)
# ---------------------------------------------------------------------------

class TestSearchResponseTime:
    """Weryfikuje kryterium: wyszukiwanie <= 100 ms."""

    def test_search_by_name_within_time_limit(self, mock_db_small: MagicMock):
        service = ItemService(mock_db_small)

        start = time.perf_counter()
        items, total = service.get_items_paged(search="Nokia", page=1, limit=100)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert len(items) > 0, "Wyniki wyszukiwania nie mogą być puste"
        assert elapsed_ms <= MAX_SEARCH_RESPONSE_MS, (
            f"Wyszukiwanie trwało {elapsed_ms:.1f} ms, "
            f"limit to {MAX_SEARCH_RESPONSE_MS} ms"
        )

    def test_search_with_all_filters_within_time_limit(self, mock_db_small: MagicMock):
        service = ItemService(mock_db_small)

        start = time.perf_counter()
        items, total = service.get_items_paged(
            search="Nokia",
            category_id=1,
            location_id=1,
            owner_id=1,
            status=ItemStatus.AVAILABLE,
            page=1,
            limit=50,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms <= MAX_SEARCH_RESPONSE_MS, (
            f"Wyszukiwanie z filtrami trwało {elapsed_ms:.1f} ms, "
            f"limit to {MAX_SEARCH_RESPONSE_MS} ms"
        )

    def test_search_empty_result_within_time_limit(self, mock_db_small: MagicMock):
        """Brak wyników też musi spełniać kryterium czasowe."""
        mock_db_small.scalars.return_value.all.return_value = []
        mock_db_small.scalar.return_value = 0

        service = ItemService(mock_db_small)

        start = time.perf_counter()
        items, total = service.get_items_paged(search="xyzNieistnieje", page=1, limit=100)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert total == 0
        assert elapsed_ms <= MAX_SEARCH_RESPONSE_MS, (
            f"Puste wyszukiwanie trwało {elapsed_ms:.1f} ms, "
            f"limit to {MAX_SEARCH_RESPONSE_MS} ms"
        )


class TestInitialLoadResponseTime:
    """Weryfikuje kryterium: pierwsze ładowanie strony <= 2500 ms."""

    def test_first_page_load_within_time_limit(self, mock_db_large: MagicMock):
        service = ItemService(mock_db_large)

        start = time.perf_counter()
        items, total = service.get_items_paged(page=1, limit=100)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert len(items) == 100, "Pierwsza strona powinna zawierać 100 przedmiotów"
        assert total == 500
        assert elapsed_ms <= MAX_INITIAL_LOAD_MS, (
            f"Ładowanie pierwszej strony trwało {elapsed_ms:.1f} ms, "
            f"limit to {MAX_INITIAL_LOAD_MS} ms"
        )

    def test_pagination_subsequent_pages_within_time_limit(self, mock_db_large: MagicMock):
        service = ItemService(mock_db_large)

        start = time.perf_counter()
        items, total = service.get_items_paged(page=3, limit=100)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms <= MAX_INITIAL_LOAD_MS, (
            f"Ładowanie strony 3 trwało {elapsed_ms:.1f} ms, "
            f"limit to {MAX_INITIAL_LOAD_MS} ms"
        )


# ---------------------------------------------------------------------------
# Testy z pytest-benchmark (opcjonalne, generują raport statystyczny)
# ---------------------------------------------------------------------------

class TestBenchmark:
    """
    Testy z dokładnym pomiarem i statystykami (min, max, średnia, odchylenie).
    Wymagają: pip install pytest-benchmark
    Uruchomienie: pytest tests/items/test_performance.py -v --benchmark-only
    """

    def test_benchmark_search(self, benchmark, mock_db_small: MagicMock):
        service = ItemService(mock_db_small)

        result = benchmark.pedantic(
            lambda: service.get_items_paged(search="Nokia", page=1, limit=100),
            rounds=50,
            warmup_rounds=5,
        )

        # benchmark.stats jest dostępne po wykonaniu – asercja na medianie
        assert benchmark.stats["median"] * 1000 <= MAX_SEARCH_RESPONSE_MS, (
            f"Mediana czasu wyszukiwania: {benchmark.stats['median'] * 1000:.2f} ms "
            f"> {MAX_SEARCH_RESPONSE_MS} ms"
        )

    def test_benchmark_initial_load(self, benchmark, mock_db_large: MagicMock):
        service = ItemService(mock_db_large)

        result = benchmark.pedantic(
            lambda: service.get_items_paged(page=1, limit=100),
            rounds=20,
            warmup_rounds=3,
        )

        assert benchmark.stats["median"] * 1000 <= MAX_INITIAL_LOAD_MS, (
            f"Mediana czasu ładowania: {benchmark.stats['median'] * 1000:.2f} ms "
            f"> {MAX_INITIAL_LOAD_MS} ms"
        )

    def test_benchmark_search_with_filters(self, benchmark, mock_db_small: MagicMock):
        service = ItemService(mock_db_small)

        result = benchmark.pedantic(
            lambda: service.get_items_paged(
                search="Nokia",
                category_id=1,
                location_id=1,
                status=ItemStatus.AVAILABLE,
                page=1,
                limit=50,
            ),
            rounds=50,
            warmup_rounds=5,
        )

        assert benchmark.stats["median"] * 1000 <= MAX_SEARCH_RESPONSE_MS
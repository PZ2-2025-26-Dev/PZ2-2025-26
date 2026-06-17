# AGENTS.md - Wytyczne Projektowe i Standardy Deweloperskie

Dokument definiuje stos technologiczny, architekturę, standardy kodowania oraz strukturę projektu dla zespołu deweloperskiego (oraz agentów AI) pracujących nad systemem API.

---

## 1. Tech Stack (Stos Technologiczny)

### API
* **Język:** Python 3.14
* **Framework:** FastAPI
* **Walidacja i Serializacja:** Pydantic v2 (deklaracja interfejsów danych, walidacja wejścia, serializacja do JSON)
* **ORM:** SQLAlchemy 2.0 (z synchronicznym connection pooling)
* **Migracje bazy danych:** Alembic (ułatwia deployment i wersjonowanie zmian w schemacie)
* **Zarządzanie zależnościami:** `uv` (szybkie i powtarzalne zarządzanie pakietami)
* **Bezpieczeństwo:**
    * `argon2-cffi` (bezpieczne hashowanie haseł)
    * `pyjwt` (generowanie i walidacja tokenów JWT)
* **Testowanie:**
    * `pytest` (testy jednostkowe wraz z `monkeypatch` lub `unittest.mock`)

### Baza danych
* **Silnik:** MySQL
* **Dialekt SQLAlchemy:** PyMySQL (`mysql+pymysql://...`)

### Deployment
* Zautomatyzowane środowisko oparte o **Docker** i **Docker Compose**.

---

## 2. Architektura i Workflow

Stawiamy na proste, czytelne i sprawdzone wzorce (bez nadmiarowych abstrakcji). Szczegółowe dobre praktyki i inspiracje znajdują się w dokumencie [FastAPI Best Practices](https://github.com/zhanymkanov/fastapi-best-practices/blob/master/README.md).

### Kluczowe założenia:
* **Brak asynchroniczności (wszystko jest synchroniczne):** Nie ma wymogu ekstremalnej wydajności współbieżnej. Kod synchroniczny upraszcza testowanie, integrację z bazą danych i zapobiega typowym błędom z `async/await`.
* **Praca równoległa:** Wykorzystujemy routery FastAPI (`APIRouter()`), dzieląc aplikację na niezależne moduły domenowe (np. `/auth`, `/items`), co minimalizuje konflikty w kodzie.

### Przepływ danych (Workflow):

```
FastAPI (Routery) -> Serwis (Logika biznesowa) -> CRUD (Opcjonalnie) -> Baza Danych (ORM)
```

1.  **Definiowanie Kontraktów (Pydantic):** W pierwszej kolejności tworzymy modele wejściowe/wyjściowe, co pozwala zespołowi frontendowemu na natychmiastową integrację.
2.  **Definiowanie Modeli DB (SQLAlchemy 2.0):** Tworzenie klas mapujących tabele.
3.  **Operacje CRUD:** Cienka warstwa nad bazą danych. Jeśli operacja to zwykłe pobranie po ID (`session.get()`), nie tworzymy dedykowanej funkcji – korzystamy bezpośrednio z sesji w serwisie.
4.  **Serwisy (Service Layer):** Tu rezyduje logika biznesowa aplikacji. Serwisy operują na bazie danych.
5.  **Routery FastAPI:** Punkty wejścia API. Korzystają z serwisów poprzez Dependency Injection (`Depends`). Całość łączona jest w `main.py` z prefiksem wersji (np. `/v1`).

---

## 3. Standardy Kodowania i Typowania

### 3.1 Nowoczesne Typowanie Pythona
Zabrania się używania przestarzałych typów z modułu `typing` (np. `typing.List`, `typing.Optional`, `typing.Dict`).
* Zamiast `Optional[T]` stosujemy `T | None`.
* Zamiast `List[T]` stosujemy `list[T]`.
* Zamiast `Dict[K, V]` stosujemy `dict[K, V]`.

### 3.2 SQLAlchemy 2.0 Style Guide
Wszystkie modele i zapytania muszą bezwzględnie korzystać ze składni SQLAlchemy 2.0 (deklaratywne mapowanie imperatywne jest zakazane).

* Używamy `Mapped[T]` oraz `mapped_column()`.
* Relacje definiujemy przez `relationship()`.
* Zapytania wykonujemy przez `session.execute(select(...))`, a proste pobieranie przez `session.get()`.

### 3.3 Dokumentacja Endpointów (OpenAPI / Swagger)
Każdy punkt wejścia (endpoint) musi być precyzyjnie opisany w dekoratorze routera. Pozwala to na automatyczne generowanie czytelnej dokumentacji dla zespołu frontendowego i zewnętrznych integracji.

* **Wymagane parametry dekoratora:** `summary` (krótki, jasny opis po polsku), `status_code` (jawnie wskazany z modułu `status`) oraz `response_model`.
* **Obsługa jawnych odpowiedzi (`responses`):** Każdy przewidywany kod odpowiedzi (zarówno sukcesy, jak i błędy typu 400, 401, 403, 404) musi być jawnie omapowany w słowniku `responses` wraz z przypisanym modelem Pydantic oraz biznesowym opisem (`description`).

### 3.4. Wzorzec Annotated i Reużywalne Typy Danych
W celu zachowania zasady DRY (Don't Repeat Yourself) oraz pełnej spójności typów, definicje walidacji Pydantic dla powtarzających się pól (np. nazwy, hasła, klucze) muszą być wynoszone do reużywalnych typów z wykorzystaniem słowa kluczowego `type` oraz `Annotated`.

* Typy domenowe definujemy na górze pliku `schemas.py` lub w dedykowanym pliku.
* Agenci i deweloperzy mają bezwzględny nakaz mapowania pól w nowych modelach z użyciem tych typów, zamiast pisania generycznych `str` czy `int`.

### 3.5. Single Source of Truth dla Stałych (`constants.py`)
Zabrania się wpisywania wartości liczbowych lub tekstowych "z palca" (hardkodowania) bezpośrednio w dekoratorach, modelach Pydantic czy modelach SQLAlchemy.

* Wszystkie limity (np. maksymalna długość znaków, zakresy liczb) muszą być zdefiniowane jako stałe w pliku `constants.py` danej domeny.
* Ta sama stała musi być użyta w definicji tabeli SQLAlchemy (`String(STAŁA)`) oraz w typie Pydantic (`Field(max_length=STAŁA)`).

---

## 4. Przykłady Implementacji
Poniżej znajdują się przykłady implementacyjne, które uwzględniają reguły opisane wyżej.
To nie jest rzeczywista implementacja w projekcie dla modeli `Item`, to tylko przykłady, które obrazują standardy programowania.

### Stałe wartości (`constants.py`)
```
# constants.py
ITEM_NAME_MAX_LENGTH = 100
```

### Modele bazy danych i Schematy (`models.py` i `schemas.py`)

```python
# models.py (SQLAlchemy 2.0)
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.database import Base
from src.users.models import User
from .constants import ITEM_NAME_MAX_LENGTH

class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(ITEM_NAME_MAX_LENGTH))
    borrowed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    borrower: Mapped[User | None] = relationship(back_populates="borrowed_items")

```

```python
# schemas.py (Pydantic v2)
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field
from .constants import ITEM_NAME_MAX_LENGTH

type ItemID = int
type ItemName = Annotated[str, Field(min_length=1, max_length=ITEM_NAME_MAX_LENGTH)]
type ItemStatus = Annotated[str, Field(min_length=1)]

class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: ItemID
    name: ItemName
    status: ItemStatus
```

### Warstwa Logiki Biznesowej (`service.py`)

```python
# service.py (Synchroniczny)
from sqlalchemy.orm import Session
from .models import Item
from .exceptions import ItemNotFound, ItemAlreadyBorrowed

class ItemService:
    def __init__(self, session: Session):
        self.session = session

    def borrow_item(self, item_id: int, user_id: int) -> Item:
        # Cienka warstwa abstrakcji - bezpośrednie użycie session.get
        item = self.session.get(Item, item_id)

        if item is None:
            raise ItemNotFound()

        if item.borrowed_by is not None:
            raise ItemAlreadyBorrowed()

        item.borrowed_by = user_id
        self.session.commit()
        return item

```

### Punkty Wejścia API (`router.py`)

```python
# router.py (FastAPI)
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from src.database import get_db
from src.auth.dependencies import get_current_user
from src.users.models import User
from src.schemas import ErrorResponse
from .schemas import ItemID, ItemResponse
from .service import ItemService

router = APIRouter(prefix="/items", tags=["items"])

@router.post(
    "/{item_id}/borrow",
    response_model=ItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Wypożycz przedmiot",
    responses={
        status.HTTP_200_OK: {
            "model": ItemResponse,
            "description": "Przedmiot został pomyślnie wypożyczony.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Przedmiot jest już wypożyczony przez innego użytkownika.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono przedmiotu o podanym ID.",
        },
    },
)
def borrow_item(
    item_id: ItemID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    service = ItemService(session)
    item = service.borrow_item(item_id, user.id)
    
    return ItemResponse(id=item.id, name=item.name, status="BORROWED")

```

---

## 5. Struktura Projektu

Projekt podzielony jest według domen funkcjonalnych:

```
src/
├── auth/                  # Domena uwierzytelniania
│   ├── router.py          # Endpointy API dla auth
│   ├── schemas.py         # Modele Pydantic
│   ├── models.py          # Modele SQLAlchemy 2.0
│   ├── service.py         # Logika biznesowa (hasła, tokeny)
│   ├── dependencies.py    # Zależności routera (np. get_current_user)
│   ├── config.py          # Konfiguracja specyficzna dla domeny (Pydantic BaseSettings)
│   ├── constants.py       # Stałe i kody błędów
│   ├── exceptions.py      # Wyjątki domenowe
│   └── utils.py           # Funkcje pomocnicze
├── {domain}/              # Inna domena aplikacji (analogicznie jak wyżej)
│   ├── router.py
│   ├── schemas.py
│   └── ...
├── config.py              # Globalna konfiguracja aplikacji (Pydantic BaseSettings)
├── models.py              # Wspólne klasy bazowe (np. Base dla ORM)
├── exceptions.py          # Globalne wyjątki i handlery
├── database.py            # Zarządzanie połączeniem z bazą (Engine, SessionLocal, get_db)
└── main.py                # Inicjalizacja FastAPI, routerów /v1 i lifespan
tests/
├── conftest.py            # Wspólne fixture DB, seeded_db i api_client
├── helpers.py             # Reużywalne stałe i funkcje pomocnicze do testów
├── auth/                  # Testy domenowe auth
└── {domain}/              # Testy domenowe, analogicznie dla każdej domeny z `src`

```

---

## 6. Organizacja Pracy i Testowanie

* **Testy Jednostkowe (Unit Tests):** Każdy programista (lub agent) dopisuje testy jednostkowe (`pytest`) dla czystej logiki biznesowej, walidacji i zachowań, które nie zależą od faktycznego silnika SQL. Nie dążymy na siłę do 100% pokrycia kodu – liczy się jakość i testowanie warunków brzegowych. Mockowanie realizujemy poprzez `monkeypatch` lub `unittest.mock`.
* **Testy Integracyjne:** Każdy test dotykający SQLAlchemy, ograniczeń relacyjnych, transakcji albo endpointów FastAPI korzystających z bazy oznaczamy przez `pytestmark = pytest.mark.integration`. Te testy muszą działać na MySQL, nie na sqlite.

Uruchamianie:
* `make unit-tests` uruchamia testy bez markera `integration`.
* `make integration-tests` uruchamia Docker Compose, bazę MySQL i testy integracyjne w kontenerze `api`.
* `make pipeline` uruchamia format check, lint, unit tests i integration tests.

Nie dodajemy nowych testów bazodanowych na sqlite. sqlite różni się od MySQL
między innymi obsługą kluczy obcych, typów, transakcji i zachowaniem połączeń
w wątkach, więc daje fałszywe poczucie bezpieczeństwa.

### 6.1. Fixture i helpery testowe

Wspólne fixture są w `tests/conftest.py`:
* `db` tworzy sesję SQLAlchemy na prawdziwej bazie i owija pojedynczy test w zewnętrzną transakcję.
* `seeded_db` wywołuje `seed_database(db)` i zwraca tę samą sesję.
* `api_client` tworzy `FastAPI TestClient` z nadpisanym `get_db`, dzięki czemu endpoint i asercje w teście widzą tę samą transakcję.
* `test_database_schema` tworzy schemat raz na sesję pytest i dropuje go po zakończeniu. Fixture przerywa działanie przy `PZ_ENV=prod`.

Nie dropujemy tabel w fixture per test. Jeżeli testowany kod wykonuje
`session.commit()`, fixture `db` nadal izoluje zmiany przez zewnętrzną transakcję
i rollback po teście.

Wspólne stałe i funkcje pomocnicze dodajemy do `tests/helpers.py`, jeżeli mogą
być użyte przez więcej niż jeden test. Aktualnie dostępne są między innymi:
* `DEFAULT_ITEM_PAYLOAD`
* `make_item_payload(**overrides)`
* `create_item_via_api(client, **overrides)`
* `get_item_or_fail(db, item_id)`
* `assert_item_created_with_history(db, item_id)`

Przykład testu endpointu i bazy:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.seed import SEED_IDS
from tests.helpers import assert_item_created_with_history, make_item_payload

pytestmark = pytest.mark.integration


def test_create_item(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        "/items",
        json=make_item_payload(name="Kamera dokumentacyjna"),
    )

    assert response.status_code == 201
    item = assert_item_created_with_history(seeded_db, response.json()["id"])
    assert item.owner_id == SEED_IDS.regular_user
```

### 6.2. Dane początkowe i izolacja testów

Moduł `src.seed` definiuje deterministyczny stan początkowy bazy:
* administratora, zwykłego użytkownika i obserwatora wraz z lokalnymi kontami,
* hierarchie lokalizacji i kategorii,
* trzy przykładowe przedmioty w różnych kategoriach i stanach.

Wspólne hasło kont seedowych to `SeedPassword123!`. Dostępne adresy e-mail:
* `admin.seed@example.com`
* `user.seed@example.com`
* `observer.seed@example.com`

Polecenie `python -m src.seed seed` jest idempotentne. Dodaje brakujące rekordy
i przywraca wartości rekordów seedowych bez tworzenia duplikatów. Konflikt
stałego ID lub unikalnego klucza z innym rekordem przerywa operację zamiast
nadpisywać obce dane.

Polecenie `python -m src.seed reset --yes` usuwa wszystkie tabele, odtwarza
schemat i dodaje seed. Jest przeznaczone wyłącznie dla środowisk developerskich
i testowych oraz zablokowane przy `PZ_ENV=prod`.

Fixture `seeded_db` dodaje ten sam zestaw danych i zwraca sesję SQLAlchemy:

```python
from sqlalchemy.orm import Session

from src.seed import SEED_IDS
from src.users.models import User


def test_example(seeded_db: Session):
    admin = seeded_db.get(User, SEED_IDS.admin_user)

    assert admin.email == "admin.seed@example.com"
```

`SEED_IDS` zawiera stabilne identyfikatory użytkowników, lokalizacji, kategorii
i przedmiotów. Fixture `db` oraz oparta na niej `seeded_db` działają wewnątrz
zewnętrznej transakcji. Po każdym teście transakcja jest wycofywana także wtedy,
gdy testowany serwis wykonał `session.commit()`.

Funkcja `seed_database(session)` nie wykonuje `commit()` i pozostawia zarządzanie
transakcją wywołującemu. Funkcja `reset_database(engine)` odtwarza schemat oraz
stan początkowy i jest programistycznym odpowiednikiem polecenia `reset`.

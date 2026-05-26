# AGENTS.md - Wytyczne Projektowe i Standardy Deweloperskie

Dokument ten definiuje stos technologiczny, architekturę, standardy kodowania oraz strukturę projektu dla zespołu deweloperskiego (oraz agentów AI) pracujących nad systemem API.

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
    * `behave` (testy funkcjonalne BDD w języku angielskim dla weryfikacji User Stories)

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

### Nowoczesne Typowanie Pythona
Zabrania się używania przestarzałych pakietów z modułu `typing` (np. `typing.List`, `typing.Optional`, `typing.Dict`).
* Zamiast `Optional[T]` stosujemy `T | None`.
* Zamiast `List[T]` stosujemy `list[T]`.
* Zamiast `Dict[K, V]` stosujemy `dict[K, V]`.

### SQLAlchemy 2.0 Style Guide
Wszystkie modele i zapytania muszą bezwzględnie korzystać ze składni SQLAlchemy 2.0 (deklaratywne mapowanie imperatywne jest zakazane).

* Używamy `Mapped[T]` oraz `mapped_column()`.
* Relacje definiujemy przez `relationship()`.
* Zapytania wykonujemy przez `session.execute(select(...))`, a proste pobieranie przez `session.get()`.

---

## 4. Przykłady Implementacji

### Modele bazy danych i Schematy (`models.py` i `schemas.py`)

```python
# models.py (SQLAlchemy 2.0)
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    
    borrowed_items: Mapped[list["Item"]] = relationship(back_populates="borrower")

class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    borrowed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    borrower: Mapped[User | None] = relationship(back_populates="borrowed_items")

```

```python
# schemas.py (Pydantic v2)
from pydantic import BaseModel, ConfigDict

class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    status: str

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
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from .schemas import ItemResponse
from .service import ItemService

router = APIRouter(prefix="/items", tags=["items"])

@router.post("/{item_id}/borrow", response_model=ItemResponse)
def borrow_item(
    item_id: int,
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
│   ├── config.py          # Konfiguracja specyficzna dla domeny (.env)
│   ├── constants.py       # Stałe i kody błędów
│   ├── exceptions.py      # Wyjątki domenowe
│   └── utils.py           # Funkcje pomocnicze
├── items/                 # Domena przedmiotów (analogicznie jak wyżej)
│   ├── router.py
│   ├── schemas.py
│   └── ...
├── config.py              # Globalna konfiguracja aplikacji (BaseSettings)
├── models.py              # Wspólne klasy bazowe (np. Base dla ORM)
├── exceptions.py          # Globalne wyjątki i handlery
├── database.py            # Zarządzanie połączeniem z bazą (Engine, SessionLocal, get_db)
└── main.py                # Inicjalizacja FastAPI, routerów /v1 i lifespan
tests/
└── auth/                  # Testy jednostkowe dla domeny auth
└── items/                 # Testy jednostkowe dla domeny items

```

---

## 6. Organizacja Pracy i Testowanie

* **Testy Jednostkowe (Unit Tests):** Każdy programista (lub agent) dopisuje testy jednostkowe (`pytest`) dla kluczowych elementów logiki biznesowej, które wprowadza w Merge Request (MR). Nie dążymy na siłę do 100% pokrycia kodu – liczy się jakość i testowanie warunków brzegowych. Mockowanie realizujemy poprzez `monkeypatch` lub `unittest.mock`.
* **Testy Funkcjonalne (BDD):** Wykorzystujemy framework `behave`. Scenariusze testowe pisane są w 100% po angielsku (język naturalny). Pozwala to na bezpośrednią weryfikację kodu z wymaganiami biznesowymi (User Stories) oraz ułatwia współpracę z działem sprzedaży/produktu (Sales/Product Owners).

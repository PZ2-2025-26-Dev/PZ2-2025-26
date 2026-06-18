## Backend

Backend jest aplikacją FastAPI. Do pracy lokalnej można używać `uv`, a do uruchomienia całego systemu rootowego `compose.yaml`.

Backendowy `Dockerfile` ma dwa targety:

- `runtime`: obraz bez zależności dev, używany przez rootowy `compose.yaml`.
- `dev`: obraz z zależnościami dev, używany przez `compose.dev.yaml`.

## Środowisko Deweloperskie

Wymagania do pracy bez Dockera:

- Python 3.14
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- `make`

Setup:

```sh
uv sync
. .venv/bin/activate
```

Jeżeli korzystacie z Nix'a, jest gotowy flake:

```sh
nix develop
```

## Makefile

Komendy backendowe są zebrane w `Makefile`. Uruchamiaj je z katalogu `backend`:

```sh
make fmt
make fmt-check
make lint
make unit-tests
make integration-tests
make pipeline
```

Możesz też uruchamiać je z katalogu głównego repozytorium:

```sh
make -C backend fmt-check
make -C backend lint
make -C backend unit-tests
make -C backend integration-tests
```

`make integration-tests` korzysta z rootowego `compose.yaml` oraz `compose.dev.yaml`, żeby uruchomić bazę i backend z zależnościami dev.

Stare skrypty z `backend/scripts` zostały zastąpione przez `Makefile`.

## Uruchamianie API + DB

Zalecana ścieżka uruchomieniowa całego systemu znajduje się w rootowym `README.md` i korzysta z rootowego `compose.yaml`.

Devowy overlay `compose.dev.yaml` dodaje bind mounty, hot reload oraz zależności dev backendu.

## Dane początkowe bazy

Dodanie lub odświeżenie przykładowych danych w bazie uruchomionej przez Docker
Compose. Polecenie nie tworzy duplikatów, ale przywraca wartości rekordów seedowych:
```sh
docker compose exec api uv run python -m src.seed seed
```

Usunięcie wszystkich danych i odtworzenie bazy do stanu początkowego. Polecenie
usuwa wszystkie tabele i jest zablokowane dla `PZ_ENV=prod`:
```sh
docker compose exec api uv run python -m src.seed reset --yes
```

Dodanie lub odświeżenie przykładowych danych bez Dockera. `PZ_DATABASE_URL` musi
wskazywać dostępną bazę, a rekordy seedowe zostaną przywrócone do domyślnych wartości:
```sh
uv run python -m src.seed seed
```

Usunięcie wszystkich danych i odtworzenie bazy bez Dockera. `PZ_DATABASE_URL`
musi wskazywać właściwą bazę; operacja bezpowrotnie usuwa jej bieżącą zawartość:
```sh
uv run python -m src.seed reset --yes
```

Użycie danych początkowych w pytest wymaga dodania fixture `seeded_db` do testu.
Fixture zwraca sesję SQLAlchemy, a wszystkie zmiany są wycofywane po teście:
```python
from sqlalchemy.orm import Session

from src.seed import SEED_IDS
from src.users.models import User

def test_example(seeded_db):
    user = seeded_db.get(User, SEED_IDS.admin_user)

    assert user.email == "admin.seed@example.com"
```

Stabilne identyfikatory rekordów są dostępne w `src.seed.SEED_IDS`.

## Testowanie

Testy są rozdzielone na dwa tryby:

- `make unit-tests` uruchamia testy bez markera `integration`. Ten tryb nie powinien wymagać działającej usługi MySQL.
- `make integration-tests` uruchamia testy oznaczone `pytestmark = pytest.mark.integration` w kontenerze `api` podłączonym do prawdziwej bazy MySQL z Docker Compose.

Testy dotykające SQLAlchemy, ograniczeń relacyjnych, transakcji albo endpointów,
które zapisują lub czytają bazę, oznaczaj jako integracyjne:

```python
import pytest

pytestmark = pytest.mark.integration
```

Wspólne fixture i helpery znajdują się w `tests/conftest.py` oraz `tests/helpers.py`:

- `db` zwraca sesję SQLAlchemy spiętą z jedną transakcją testową.
- `seeded_db` wywołuje `seed_database(db)` i zwraca tę samą sesję.
- `api_client` zwraca `FastAPI TestClient`, w którym `get_db` jest nadpisane tak, aby endpoint używał tej samej sesji co test.
- `helpers.py` służy modularyzacji i reużywalności kodu, zawiera często występujące stałe i skrypty testowe. Moduł jest otwarty do modyfikacji, dodawaj do niego często powtarzające się fragmenty kodu.

Schemat bazy dla testów integracyjnych jest tworzony raz na sesję pytest.
Pojedyncze testy nie dropują tabel. Zmiany wykonane w teście, również te po
`session.commit()` w serwisie, są izolowane zewnętrzną transakcją i wycofywane
po teście. Dzięki temu testy powinny pozostać szybkie mimo użycia realnego MySQL.

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

Inne przykładowe testy wraz z przypadkami użycia helperów i seedowania: 
- `tests/items/test_item_router_integration.py`
- `tests/items/test_item_service_integration.py`
- `tests/users/test_user_service.py`
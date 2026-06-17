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

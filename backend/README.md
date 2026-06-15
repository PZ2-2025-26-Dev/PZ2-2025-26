## Środowisko deweloperskie

Wymagania:
- Python 3.14
- [uv](https://docs.astral.sh/uv/getting-started/installation/)

Setup:
```sh
uv sync
. .venv/bin/activate
```

Jeżeli korzystacie z Nix'a to jest gotowy flake, wystarczy:
```sh
nix develop
```

## Skrypty

Formatowanie:
```sh
./scripts/fmt.sh
```

Lint:
```sh
./scripts/lint.sh
```

Testy jednostkowe:
```sh
./scripts/unit-tests.sh
```

Testy integracyjne (API + DB w kontenerach):
```sh
./scripts/integration-tests.sh
```

Wykonaj przed wrzuceniem PR i upewnij się, że nie ma żadnych błędów:
```sh
./scripts/pipeline.sh
```

## Uruchamianie API + DB

Mamy dockerfile dla API: `./Dockerfile`

Mamy `./compose.yaml`, który pozwala uruchomić API + DB:
```sh
cp example.env .env
docker compose up --build
```

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

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

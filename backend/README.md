## Środowisko deweloperskie

Wymagania:
- Python 3.14
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Docker i Docker Compose

Setup lokalny:
```sh
uv sync
. .venv/bin/activate
```

Mamy też dedykowane środowisko deweloperskie w kontenerze, gdzie lokalne zmiany w plikach są widoczne w kontenerze real-time:
```sh
# podstawowa konfiguracja środowiska
cp example.env .env

# odpalenie kontenerów (baza danych i API)
docker compose -f compose.dev.yaml up

# wejście do shell'a w kontenerze z API
docker compose -f compose.dev.yaml exec api-dev-env sh

# tutaj możecie wykonywać wszystkie istotne komendy, np.
make fmt
make lint
make unit-tests

# żeby wyjść z shella można użyć polecenia 'exit' albo użyć CTRL+D
exit

# clean up
docker compose -f compose.dev.yaml down --volumes
```

Jeżeli ktoś korzysta z Nix'a to jest gotowy flake, wystarczy:
```sh
nix develop
```

## Komendy

Formatowanie:
```sh
make fmt
```

Lint:
```sh
make lint
```

Testy jednostkowe:
```sh
make unit-tests
```

Testy integracyjne (API + DB w kontenerach):
```sh
# tego nie da się uruchomić będąc w kontenerze! ta komenda pod spodem stawia kontenery, więc jest kolizja
make integration-tests
```

## Uruchamianie API + DB w wersji produkcyjnej
Mamy `./compose.yaml`, który pozwala uruchomić API + DB:
```sh
cp example.env .env
docker compose up --build
```

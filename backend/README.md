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

## Uruchamianie

Jest dedykowany obraz dockerowy dla API: `./Dockerfile`

Jest docker compose, który uruchamia bazę danych i API.
Zanim uruchomisz kontenery, musisz ustawić zmienne środowiskowe opisane w pliku `compose.yaml`.
Zamiast manualnie ustawiać te zmienne możesz po prostu skopiować przykładowe środowisko: `cp example.env .env`.
Docker automatycznie je zaczyta.

Uruchomianie API + DB:
```sh
docker compose up --build
```

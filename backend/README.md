## Backend

Backend jest aplikacją FastAPI. Do pracy lokalnej można używać `uv`, a do uruchomienia całego systemu rootowego `compose.yaml`.

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

Komendy backendowe są zebrane w `Makefile`:

```sh
make fmt
make fmt-check
make lint
make unit-tests
make integration-tests
make pipeline
```

`make integration-tests` korzysta z rootowego `compose.yaml` oraz `compose.dev.yaml`, żeby uruchomić bazę i backend z zależnościami dev.

## Uruchamianie API + DB

Zalecana ścieżka uruchomieniowa całego systemu znajduje się w rootowym `README.md` i korzysta z rootowego `compose.yaml`.

Devowy overlay `compose.dev.yaml` dodaje bind mounty, hot reload oraz zależności dev backendu.

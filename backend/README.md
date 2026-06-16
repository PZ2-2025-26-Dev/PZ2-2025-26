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

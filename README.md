# PZ2 2025/26

Repozytorium zawiera backend FastAPI, frontend React/Vite oraz konfigurację Docker Compose do uruchomienia systemu.

## Wymagania

- Docker Desktop albo Docker Engine z pluginem `docker compose`
- Wolne porty: `5173` dla frontendu, `8000` dla API, `8080` dla Adminera

Nie trzeba lokalnie instalować Pythona, Node.js ani MySQL, jeżeli uruchamiasz projekt przez Docker Compose.

## Szybki Start

Z katalogu głównego repozytorium:

```sh
cp .env.example .env
docker compose up --build
```

Po starcie usługi powinny być dostępne pod adresami:

- frontend: `http://localhost:5173`
- backend API: `http://localhost:8000`
- dokumentacja OpenAPI: `http://localhost:8000/docs`
- healthcheck API: `http://localhost:8000/ready`
- Adminer: `http://localhost:8080`

## Tryb Developerski

Rootowy `compose.yaml` uruchamia kod skopiowany do obrazów podczas builda. Do codziennej pracy użyj overlay'a `compose.dev.yaml`, który dodaje bind mounty, hot reload oraz zależności dev backendu.

```sh
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

W trybie dev:

- backend ma podmontowany katalog `./backend` do `/app`
- backend uruchamia `uv sync --locked --dev`, więc ma dostęp do `pytest`, `ruff` i innych zależności dev
- frontend ma podmontowany katalog `./frontend` do `/app`
- frontend uruchamia Vite dev server przez `npm run dev`
- zależności są trzymane w wolumenach `backend_venv` i `frontend_node_modules`

Po zmianach w Dockerfile'ach albo lockfile'ach przebuduj obrazy:

```sh
docker compose -f compose.yaml -f compose.dev.yaml build
```

## Konfiguracja `.env`

Rootowy `compose.yaml` wymaga jawnej konfiguracji z pliku `.env`. Skopiuj `.env.example` do `.env` i zmieniaj tylko potrzebne wartości.

Najważniejsze zmienne:

- `DB_ROOT_PWD`, `DB_NAME`, `DB_USER`, `DB_PWD` konfigurują kontener MySQL.
- `API_PORT` wystawia FastAPI na hoście, domyślnie `8000`.
- `PZ_DATABASE_URL` jest adresem bazy widzianym z kontenera backendu. W Compose host bazy to `db`, nie `localhost`.
- `PZ_CORS_ORIGINS` określa dozwolone originy frontendu.
- `FRONTEND_PORT` wystawia frontend na hoście, domyślnie `5173`.
- `VITE_API_URL` jest adresem API widzianym z przeglądarki użytkownika, dlatego domyślnie wskazuje `http://localhost:8000`.
- `ADMINER_PORT` wystawia Adminera na hoście, domyślnie `8080`.

Jeżeli port `8000`, `5173` albo `8080` jest zajęty, zmień odpowiednio `API_PORT`, `FRONTEND_PORT` albo `ADMINER_PORT` w `.env`. Przy zmianie portu API pamiętaj też o aktualizacji `VITE_API_URL` i `PZ_CORS_ORIGINS`.

MySQL nie jest wystawiony bezpośrednio na hosta. Do podglądu bazy użyj Adminera:

- system: `MySQL`
- server: `db`
- username: wartość `DB_USER` z `.env`
- password: wartość `DB_PWD` z `.env`
- database: wartość `DB_NAME` z `.env`

## Przydatne Komendy

Uruchomienie całego systemu:

```sh
docker compose up --build
```

Uruchomienie całego systemu w trybie dev:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

Uruchomienie w tle:

```sh
docker compose up --build -d
```

Podejrzenie logów:

```sh
docker compose logs -f
```

Podejrzenie logów wybranej usługi:

```sh
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f adminer
```

Zatrzymanie kontenerów bez kasowania danych bazy:

```sh
docker compose down
```

Zatrzymanie kontenerów i usunięcie lokalnego wolumenu MySQL:

```sh
docker compose down -v
```

Przebudowanie tylko jednej usługi:

```sh
docker compose build api
docker compose build frontend
```

## Usługi W Compose

`compose.yaml` w katalogu głównym uruchamia:

- `db`: MySQL z trwałym wolumenem `mysql_data`.
- `api`: backend FastAPI budowany z `backend/Dockerfile`.
- `frontend`: frontend budowany z `frontend/Dockerfile`.
- `adminer`: webowy klient do bazy danych.

Backend czeka na zdrową bazę danych przez `depends_on` z healthcheckiem MySQL. Frontend czeka na zdrowe API sprawdzane przez endpoint `/ready`.

`compose.dev.yaml` jest tylko developerskim overlayem. Nie uruchamiaj go samodzielnie, tylko razem z rootowym Compose:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

## Troubleshooting

Jeżeli `docker compose up --build` kończy się błędem podobnym do:

```text
unable to get image 'pz/frontend': error during connect
open //./pipe/dockerDesktopLinuxEngine: Nie można odnaleźć określonego pliku.
```

to Docker CLI nie połączył się z Docker Desktop Linux Engine. Najczęstsze przyczyny:

- Docker Desktop nie jest uruchomiony.
- Docker Desktop jeszcze startuje i daemon nie jest gotowy.
- Docker Desktop działa w trybie Windows containers zamiast Linux containers.
- WSL/Docker Desktop wymaga restartu po aktualizacji.

Sprawdź najpierw:

```powershell
docker version
docker compose version
```

Jeżeli `docker version` nie pokazuje sekcji `Server`, uruchom Docker Desktop i poczekaj, aż status zmieni się na running. Na Windowsie upewnij się też, że Docker Desktop używa Linux containers.

## Uruchamianie Części Systemu

Tylko baza i backend:

```sh
docker compose up --build db api adminer
```

Tylko frontend, gdy API działa już gdzie indziej:

```sh
docker compose up --build frontend
```

W takim przypadku ustaw w `.env` `VITE_API_URL` na adres używanego backendu, np.:

```env
VITE_API_URL=http://localhost:8000
```

## Uruchamianie Bez Dockera

Instrukcje specyficzne dla lokalnego uruchamiania backendu i frontendu znajdują się w:

- `backend/README.md`
- `frontend/README.md`

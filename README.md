# PZ2 2025/26

Repozytorium zawiera backend FastAPI, frontend React/Vite oraz konfigurację Docker Compose do lokalnego uruchomienia całego systemu.

## Wymagania

- Docker Desktop albo Docker Engine z pluginem `docker compose`
- Wolne porty: `5173` dla frontendu, `8000` dla API, `3306` dla MySQL

Nie trzeba lokalnie instalować Pythona, Node.js ani MySQL, jeżeli uruchamiasz projekt przez Docker Compose.

## Szybki start całego systemu

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
- MySQL: `localhost:3306`

Na Windowsie w PowerShell odpowiednikiem kopiowania pliku env jest:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

## Konfiguracja `.env`

Plik `.env.example` zawiera wartości deweloperskie, które pozwalają uruchomić system bez dodatkowej konfiguracji. Do pracy lokalnej skopiuj go do `.env` i zmieniaj tylko potrzebne wartości.

Najważniejsze zmienne:

- `DB_ROOT_PWD`, `DB_NAME`, `DB_USER`, `DB_PWD` konfigurują kontener MySQL.
- `DB_PORT` wystawia MySQL na hoście, domyślnie `3306`.
- `API_PORT` wystawia FastAPI na hoście, domyślnie `8000`.
- `PZ_DATABASE_URL` jest adresem bazy widzianym z kontenera backendu. W Compose host bazy to `db`, nie `localhost`.
- `PZ_CORS_ORIGINS` określa dozwolone originy frontendu.
- `FRONTEND_PORT` wystawia Vite na hoście, domyślnie `5173`.
- `VITE_API_URL` jest adresem API widzianym z przeglądarki użytkownika, dlatego domyślnie wskazuje `http://localhost:8000`.

Jeżeli port `3306`, `8000` albo `5173` jest zajęty, zmień odpowiednio `DB_PORT`, `API_PORT` albo `FRONTEND_PORT` w `.env`. Przy zmianie portu API pamiętaj też o aktualizacji `VITE_API_URL` i `PZ_CORS_ORIGINS`.

## Przydatne komendy Docker Compose

Uruchomienie całego systemu:

```sh
docker compose up --build
```

Uruchomienie w tle:

```sh
docker compose up --build -d
```

Podejrzenie logów:

```sh
docker compose logs -f
```

Podejrzenie logów tylko backendu albo frontendu:

```sh
docker compose logs -f api
docker compose logs -f frontend
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

## Usługi w Compose

`compose.yaml` w katalogu głównym uruchamia trzy usługi:

- `db`: MySQL z trwałym wolumenem `mysql_data`.
- `api`: backend FastAPI budowany z `backend/Dockerfile`.
- `frontend`: frontend Vite budowany z `frontend/Dockerfile`.

Backend czeka na zdrową bazę danych przez `depends_on` z healthcheckiem MySQL. Frontend startuje po uruchomieniu kontenera API.

Kod backendu i frontendu jest podmontowany do kontenerów, więc zwykłe zmiany w plikach źródłowych powinny być widoczne bez przebudowywania obrazów. Przy starcie kontener API wykonuje `uv sync --locked`, a kontener frontendu `npm install`, żeby zależności w wolumenach nadążały za lockfile'ami.

Po zmianach w samych Dockerfile'ach albo gdy chcesz odświeżyć obraz od zera, przebuduj odpowiednią usługę:

```sh
docker compose build api
docker compose build frontend
```

## Uruchamianie części systemu

Tylko baza i backend:

```sh
docker compose up --build db api
```

Tylko frontend, gdy API działa już gdzie indziej:

```sh
docker compose up --build frontend
```

W takim przypadku ustaw w `.env` `VITE_API_URL` na adres używanego backendu, np.:

```env
VITE_API_URL=http://localhost:8000
```

## Uruchamianie bez Dockera

Instrukcje specyficzne dla lokalnego uruchamiania backendu i frontendu znajdują się w:

- `backend/README.md`
- `frontend/README.md`

Ścieżka Docker Compose jest zalecana do szybkiego sprawdzenia całego systemu, bo zapewnia spójną wersję bazy, backendu i frontendu dla wszystkich osób w zespole.

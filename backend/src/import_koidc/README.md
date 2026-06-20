# Import danych ze starego systemu koidc

Skrypt `src.import_koidc` przenosi dane ewidencji sprzętu ze starej bazy **koidc** (phpMyAdmin, tabele `inv_*` i `pracownicy`) do schematu aplikacji PZ2.

Moduł **nie importuje** dumpa SQL wprost do MySQL. Odczytuje dane ze zrzutu lub plików CSV, mapuje je na modele SQLAlchemy i zapisuje w docelowej bazie (`location`, `category`, `item`, `user`).

---

## Co robi skrypt

### Komenda `extract`

Wyciąga dane ze zrzutu SQL phpMyAdmin i zapisuje je jako pliki CSV w katalogu `backend/legacy/`:

| Plik CSV | Stara tabela |
|----------|--------------|
| `pracownicy.csv` | `pracownicy` |
| `inv_budynki.csv` | `inv_budynki` |
| `inv_pokoje.csv` | `inv_pokoje` |
| `inv_typy_urz.csv` | `inv_typy_urz` |
| `inv_producenci.csv` | `inv_producenci` |
| `inv_modele.csv` | `inv_modele` |
| `inv_urzadzenia.csv` | `inv_urzadzenia` |

### Komenda `import`

Importuje dane do bazy PZ2 według poniższego mapowania:

| Źródło (koidc) | Cel (PZ2) | Uwagi |
|----------------|-----------|-------|
| `pracownicy` | `user` | rola `USER`; brak e-maila → `brak_maila_{id}@koidc.local` |
| `inv_budynki` | `location` | typ `BUILDING`, zachowane ID |
| `inv_pokoje` | `location` | typ `ROOM`, **ID pokoju = stare ID + 10 000** |
| `inv_typy_urz` | `category` | zachowane ID |
| `inv_producenci` + `inv_modele` + `inv_urzadzenia` | `item` | nazwa: `{producent} {model}` |
| `inv_urzadzenia.id_pracownika` | `item.owner_id` | mapowanie na zaimportowanego `user`; brak/0/nieznany → fallback `999999` |
| `inv_urzadzenia.wypozyczony = 1` | `item.status = loaned` | w przeciwnym razie `available` |
| numer seryjny, nr inw., opisy | `item.description` | sklejone w jedno pole (max 256 znaków) |
| brak UUID w starym systemie | `item.inventory_number` | deterministyczne UUID v5 z ID urządzenia |

Dodatkowo tworzony jest techniczny użytkownik fallback (gdy brak `id_pracownika` lub nie ma takiego użytkownika w imporcie):

- e-mail: `legacy.import@koidc.local`
- ID: `999999`

Przedmioty dostają właściciela z pola `id_pracownika` (tabela `pracownicy` → `user` z tym samym ID). Tylko gdy ID jest puste, równe 0 lub nie występuje w zaimportowanych pracownikach, używany jest użytkownik fallback.

Przy pierwszym imporcie każdego przedmiotu powstaje wpis w `item_history` z typem `created`.

---

## Wymagania

- Działająca baza MySQL skonfigurowana przez `PZ_DATABASE_URL` (np. przez Docker Compose).
- Zrzut SQL ze starymi tabelami **lub** gotowy katalog `backend/legacy/` z plikami CSV.

Domyślne ścieżki:

- zrzut SQL: `backend/sample_dump.sql`
- CSV legacy: `backend/legacy/`

---

## Uruchomienie

### Dev

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
docker compose exec api uv run python -m src.import_koidc import --sql-file /app/sample_dump.sql
```

### Klient

```powershell
docker compose up --build -d
docker compose cp backend/sample_dump.sql api:/app/sample_dump.sql
docker compose exec api uv run python -m src.import_koidc import --sql-file /app/sample_dump.sql
```

---

## Uruchomienie bez Dockera

Z katalogu `backend/`, gdy `PZ_DATABASE_URL` wskazuje dostępną bazę:

```powershell
uv run python -m src.import_koidc extract --sql-file sample_dump.sql
uv run python -m src.import_koidc import --clear-existing
```

---

## Przykładowy output

```
[IMPORT] Import zakończony.
Użytkownicy: +42, kategorie: 25, lokalizacje: 11, przedmioty: 243, pominięte: 2
```

- **pominięte** — urządzenia bez istniejącego pokoju lub modelu w danych źródłowych.

---

## Ograniczenia

- Import dotyczy wyłącznie ewidencji sprzętu; tabele takie jak `grupy`, `log_changes` czy `publikacje` nie są obsługiwane.
- Wypożyczenia ze starego systemu nie trafiają do tabeli `loan` — ustawiany jest tylko status `loaned` na przedmiocie.
- Przy ponownym imporcie bez `--clear-existing` istniejące rekordy o tych samych ID są **aktualizowane** (upsert), a nie duplikowane.
- Nie uruchamiaj `--clear-existing` na produkcji bez kopii zapasowej bazy.

---

## Struktura modułu

```
backend/src/import_koidc/
├── README.md       ← ten plik
├── __main__.py     ← CLI (extract / import)
├── parser.py       ← odczyt SQL i CSV
└── service.py      ← mapowanie i zapis do bazy
```

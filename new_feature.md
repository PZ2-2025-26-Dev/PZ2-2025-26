# PR: Wypożyczenia zewnętrzne (Goście)

**User story:** Właściciel rejestruje wypożyczenie sprzętu podmiotowi zewnętrznemu (Gościowi) z terminem zwrotu.

## TL;DR

- Gość = `User` z rolą `GUEST` (bez logowania, bez osobnej tabeli `guest`)
- Wypożyczenie = rekord `Loan` (`ACTIVE` → `RETURNED`), historia w `loan` + `item_history`
- API: `/guests`, `/loans` · UI: zakładka Goście + panel wypożyczenia w karcie przedmiotu

## Decyzje

| Co | Jak |
|---|---|
| Gość | `User` + `GUEST`, opcjonalny email, brak `UserAccount` |
| Uprawnienia | `user`/`admin` dodaje gościa; tylko `admin` edytuje/usuwa |
| Wypożyczenie | `user`/`admin` rejestruje; obiekt musi być `AVAILABLE`, borrower = `GUEST` |

## API

| Metoda | Path | Kto |
|--------|------|-----|
| POST/GET | `/guests` | dodaj / lista |
| GET/PUT/DELETE | `/guests/{id}` | szczegóły / edycja (admin) / usuń (admin) |
| POST | `/loans` | rejestracja wypożyczenia |
| GET | `/loans` | historia (filtry: `item_id`, `borrower_id`, `loan_status`) |
| POST | `/loans/{id}/return` | zwrot |

**Flow wypożyczenia:** walidacja → `Loan(ACTIVE)` + item `LOANED` + `item_history(LOANED)` → zwrot → `RETURNED` + item `AVAILABLE` + `item_history(RETURNED)`.

## Baza danych

**Zmiany schematu:**
- `user.role` → +`GUEST`; `user.email` → nullable
- tabela `guest` → **usunięta**
- `loan` → nowy kształt (`borrower_id`, `registered_by`, `status` ACTIVE/RETURNED)
- `item_history.change_type` → +`RETURNED`

**Świeża baza (pusty volume):** `create_all` przy starcie API wystarczy → potem `python -m src.seed seed`.

**Stara baza dev:** `create_all` **nie migruje** ENUM-ów ani nie dropuje `guest`. Trzeba:
```bash
docker compose exec api uv run python -m src.seed reset --yes
```
albo ręczne ALTER-y (ENUM wielkimi literami: `ADMIN`, `GUEST` — jak reszta projektu).

Brak Alembica — to workaround do czasu migracji.

## Backend (pliki)

`guests/`, `loans/` (rewrite) · `auth` (GUEST, blokada loginu, `RequireUserOrAdmin`) · `users` (nullable email, bez GUEST w liście) · `items` (+`RETURNED`) · `seed` (Gabriel Guest `10004`)

## Frontend

- `GuestManager` — CRUD gości
- `ItemDetailsModal` — wypożyczenie/zwrot/historia (tylko itemy z API, numeryczne `id`)
- `DashboardPage` — lista z `GET /items`, hooki `useGuests` / `useRentals`

## Test plan

```bash
make -C backend integration-tests   # guests + loans na MySQL
```

Ręcznie: seed → dodaj gościa → otwórz item `40001` jako owner → wypożycz → zwrot.

**Seed:** `admin.seed@example.com` / `user.seed@example.com` — hasło `SeedPassword123!` · gość testowy: Gabriel Guest (`guest.seed@example.com`, bez loginu)

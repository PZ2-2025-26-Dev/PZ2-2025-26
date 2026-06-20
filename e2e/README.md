# Testy E2E

## Testy obiciążeniowe (load tests)

Testy obciążeniowe są niefunkcjonalne, wykonywane są dla weryfikacji wydajności aplikacji.

Stos technologiczny:
- Docker i `docker compose`
- Grafana k6 0.52.0

Uruchomienie testów, będąc w katalogu `e2e/`:

```sh
make load-tests
```

W katalogu głównym:

```sh
make -C e2e load-tests
```

Wyniki testów zapisywane jest do `e2e/results/summary.json`.
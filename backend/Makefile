CODEDIRS=src tests

all: fmt lint unit-tests

fmt:
# '--select I' wykonuje tylko check dla sortowania importów
	uv run ruff check --select I --fix $(CODEDIRS)
	uv run ruff format $(CODEDIRS)

fmt-check:
	uv run ruff format --check $(CODEDIRS)
	uv run ruff check --select I $(CODEDIRS)

lint:
	uv run ruff check $(CODEDIRS)

unit-tests:
	uv run python -m pytest -vv tests -m "not integration"

integration-tests:
# '--wait' bo czekamy aż db i api wstaną i będą ready
	docker compose -f compose.dev.yaml up --build --wait
	docker compose exec api-dev-env uv run python -m pytest -vv tests -m "integration"
	docker compose -f compose.dev.yaml down --volumes


.PHONY: lint fmt fmt-check unit-tests integration-tests

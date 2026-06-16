CODEDIRS = src tests
ROOT_DIR := $(abspath $(CURDIR)/..)
COMPOSE := docker compose -f $(ROOT_DIR)/compose.yaml -f $(ROOT_DIR)/compose.dev.yaml

all: fmt lint unit-tests

fmt:
	uv run ruff check --select I --fix $(CODEDIRS)
	uv run ruff format $(CODEDIRS)

fmt-check:
	uv run ruff format --check $(CODEDIRS)
	uv run ruff check --select I $(CODEDIRS)

lint:
	uv run ruff check $(CODEDIRS)

unit-tests: export PZ_DATABASE_URL := sqlite:///:memory:
unit-tests:
	uv run python -m pytest -vv tests -m "not integration"

integration-tests:
	$(COMPOSE) up --build --wait db api
	$(COMPOSE) exec api uv run python -m pytest -vv tests -m "integration"
	$(COMPOSE) down --volumes

pipeline: fmt-check lint unit-tests integration-tests

.PHONY: all fmt fmt-check lint unit-tests integration-tests pipeline

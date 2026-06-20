ROOT_DIR := $(abspath $(CURDIR)/..)
COMPOSE := docker compose --env-file $(ROOT_DIR)/.env --env-file $(CURDIR)/load-tests.env -f $(ROOT_DIR)/compose.yaml -f $(ROOT_DIR)/compose.dev.yaml
APP_SERVICES := db api frontend
LOAD_SERVICE := load-tests

all: load-tests

up:
	$(COMPOSE) up --build --wait $(APP_SERVICES)

seed-reset: up
	$(COMPOSE) exec -T api uv run python -m src.seed reset --yes

load-tests:
	status=0; \
	$(COMPOSE) up --build --wait $(APP_SERVICES); \
	$(COMPOSE) exec -T api uv run python -m src.seed reset --yes; \
	$(COMPOSE) run --rm $(LOAD_SERVICE) || status=$$?; \
	$(COMPOSE) down --volumes; \
	exit $$status

down:
	$(COMPOSE) down --volumes

.PHONY: all up seed-reset load-tests down

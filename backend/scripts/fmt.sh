#!/bin/sh

# isort
uv run ruff check --select I --fix src || exit $?

uv run ruff format src || exit $?

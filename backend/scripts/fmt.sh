#!/bin/sh

. "$(dirname $0)/lib.sh"

# isort
uv run ruff check --select I --fix ${PZ_RUFF_TARGETS?} || exit $?

uv run ruff format ${PZ_RUFF_TARGETS?} || exit $?

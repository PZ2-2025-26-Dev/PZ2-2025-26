#!/bin/sh

. "$(dirname $0)/lib.sh"

export PZ_DATABASE_URL="sqlite:///:memory:"

uv run python -m pytest -vv "${PZ_TESTS_DIR?}" -m "not integration" || exit $?

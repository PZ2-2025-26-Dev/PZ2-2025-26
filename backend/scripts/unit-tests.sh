#!/bin/sh

. "$(dirname $0)/lib.sh"

uv run python -m pytest -vv "${PZ_BACKEND_DIR?}/tests" || exit $?

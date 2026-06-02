#!/bin/sh

. "$(dirname $0)/lib.sh"

uv run ruff format --check ${PZ_RUFF_TARGETS?} || exit $?

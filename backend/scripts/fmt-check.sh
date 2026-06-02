#!/bin/sh
uv run ruff format --check src || exit $?

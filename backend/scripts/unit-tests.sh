#!/bin/sh
uv run python -m pytest -vv tests || exit $?

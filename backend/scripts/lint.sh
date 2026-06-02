#!/bin/sh
uv run ruff check src || exit $?

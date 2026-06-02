#!/bin/sh

if ! command -v git 1>/dev/null; then
    printf 'ERROR: git is not installed but required!\n' 1>&2
    exit 1;
fi

if ! PZ_ROOT_DIR=$(git rev-parse --show-toplevel); then
    printf 'ERROR: could not read root directory with git, make sure you execute the script within the repository\n'
    exit 1;
fi

PZ_BACKEND_DIR="${PZ_ROOT_DIR?}/backend"
PZ_RUFF_TARGETS="${PZ_BACKEND_DIR?}/src"

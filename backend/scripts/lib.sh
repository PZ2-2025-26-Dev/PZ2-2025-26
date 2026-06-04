#!/bin/sh

error() {
    printf 'ERROR: %s\n' "$*" 1>&2
    exit 1
}

check_cmd() {
    if ! command -v $1 1>/dev/null; then
        error "$1 is missing but required!"
    fi
}

check_cmd git

if ! PZ_ROOT_DIR=$(git rev-parse --show-toplevel); then
    error "could not read root directory with git, make sure you execute the script within the repository"
fi

PZ_BACKEND_DIR="${PZ_ROOT_DIR?}/backend"
PZ_RUFF_TARGETS="${PZ_BACKEND_DIR?}/src ${PZ_BACKEND_DIR?}/tests"

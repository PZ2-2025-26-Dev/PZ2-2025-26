#!/bin/sh

. "$(dirname $0)/lib.sh"

check_cmd docker
check_cmd curl
check_cmd grep
check_cmd sed
check_cmd uv

trap 'docker compose --file ${PZ_BACKEND_DIR?}/compose.yaml down && docker volume rm backend_mysql_data' EXIT

if [ ! -f "${PZ_BACKEND_DIR?}/.env" ]; then
    error ".env file is missing! (looking in ${PZ_BACKEND_DIR?})"
fi

docker compose --file "${PZ_BACKEND_DIR?}/compose.yaml" up --build --detach || exit $?

API_READY=0
for i in 1 2 3 4 5; do

    printf 'Waiting for API to be ready (%d/5)...' $i

    if curl --connect-timeout 1 localhost:8000/ready 2>/dev/null 1>&2; then
        API_READY=1
        printf ' READY!\n'
        break
    fi

    sleep 5
    printf '\r'

done

if [ $API_READY -ne 1 ]; then
    error 'exceeded wait time for API startup'
fi

. "${PZ_BACKEND_DIR?}/.env" || exit $?

if [ -z "$PZ_DATABASE_URL" ]; then
    error "variable PZ_DATABASE_URL is not set!"
fi

PZ_DATABASE_URL=$(printf '%s\n' "${PZ_DATABASE_URL?}" | sed -e 's/@db/@localhost/') || exit $?
export PZ_DATABASE_URL

uv run python -m pytest -vv "${PZ_BACKEND_DIR?}/tests" || exit $?

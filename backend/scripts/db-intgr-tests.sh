#!/bin/sh

. "$(dirname $0)/lib.sh"

check_cmd docker
check_cmd curl
check_cmd grep
check_cmd sed
check_cmd uv

if [ ! -f "${PZ_BACKEND_DIR?}/.env" ]; then
    error ".env file is missing! (looking in ${PZ_BACKEND_DIR?})"
fi

if ! DB_URL=$(grep "PZ_DATABASE_URL" .env); then
    error ".env file is missing the PZ_DATABASE_URL variable"
fi

DB_URL=${DB_URL#*=}  # remove everything before '=' (including)
DB_URL=$(printf '%s\n' "$DB_URL" | sed -e 's/@db/@localhost/') || exit $? # replace '@db' with '@localhost'

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
    error 'exceeded wait time for API startup (~50s)'
fi

PZ_DATABASE_URL="$DB_URL" uv run python -m pytest -vv "${PZ_BACKEND_DIR?}/tests" || exit $?

docker compose down || exit $?
docker volume rm backend_mysql_data || exit $?

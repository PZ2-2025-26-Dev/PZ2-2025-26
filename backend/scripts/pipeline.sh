#!/bin/sh

SCRIPTS_DIR=$(dirname $0)

run() {
    if [ ! -x $1 ]; then
        printf 'Script %s does not exist or is not executable\n' "$1" 1>&2
        exit 1
    fi

    CMD="sh $1"

    printf '=== RUN: %s ===\n' "$CMD"
    $CMD || exit $?
    printf '\n'
}

run "${SCRIPTS_DIR}/fmt-check.sh" || exit $?
run "${SCRIPTS_DIR}/lint.sh" || exit $?
run "${SCRIPTS_DIR}/unit-tests.sh" || exit $?
run "${SCRIPTS_DIR}/integration-tests.sh" || exit $?

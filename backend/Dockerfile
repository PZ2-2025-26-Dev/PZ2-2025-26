FROM ghcr.io/astral-sh/uv:0.11.16-python3.14-alpine AS base

WORKDIR /app

# ---
# 'Changing the UV_LINK_MODE silences warnings about
# not being able to link files since the cache and sync target are on separate file systems.'
# https://docs.astral.sh/uv/guides/integration/docker/#caching
# ---
ENV UV_LINK_MODE=copy

# najpierw sync bez instalacji projektu bo lepszy caching
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project

COPY README.md pyproject.toml uv.lock /app

COPY ./src/ /app/src


# DEV
FROM base AS dev

RUN apk add make

COPY Makefile /app

COPY ./tests/ /app/tests

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked
# END_DEV


# PROD
FROM base AS prod

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --locked
# END_PROD

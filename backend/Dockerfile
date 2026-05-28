# 3.14-slim
#FROM python@sha256:c845af9399020c7e562969a13689e929074a10fd057acd1b1fad06a2fb068e97

#COPY --from=ghcr.io/astral-sh/uv:0.11.16-alpine /uv /uvx /bin/
FROM ghcr.io/astral-sh/uv:0.11.16-python3.14-alpine

WORKDIR /app

# bez zależności z grupy "dev"
ENV UV_NO_DEV=1

# ---
# Changing the UV_LINK_MODE silences warnings about
# not being able to link files since the cache and sync target are on separate file systems.
# ---
ENV UV_LINK_MODE=copy

# najpierw sync bez instalacji projektu bo lepszy caching
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project

COPY README.md pyproject.toml uv.lock /app

COPY ./src/ /app/src

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked

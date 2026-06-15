# syntax=docker/dockerfile:1.7

FROM ghcr.io/astral-sh/uv:0.11.16-python3.14-alpine

WORKDIR /app

# Bez zaleznosci z grupy "dev".
ENV UV_NO_DEV=1

# Changing UV_LINK_MODE silences warnings about cache and sync target
# being on separate file systems.
# https://docs.astral.sh/uv/guides/integration/docker/#caching
ENV UV_LINK_MODE=copy

# Sync dependencies first for better Docker layer caching.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project

COPY README.md pyproject.toml uv.lock /app/
COPY ./src/ /app/src/

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked

EXPOSE 8000

CMD ["uv", "run", "fastapi", "dev", "src/main.py", "--host", "0.0.0.0", "--port", "8000"]

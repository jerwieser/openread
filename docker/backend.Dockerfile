FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    # Venv lives outside /app so the dev bind mount doesn't hide it.
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Built from the project root (see docker-compose.yml and the CI workflow): the backend needs the database
# folder too (db/), for its migrations. Dependencies first (cached layer),
# then the code.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY backend backend
COPY db db
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

RUN useradd --create-home --uid 1000 app && chown -R app /app
USER app

EXPOSE 8000
# Production (Azure App Service): migrate and serve. Locally
# docker-compose.yml runs its own command instead, with hot reload.
CMD ["backend/start.sh"]

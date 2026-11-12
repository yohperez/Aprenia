FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /usr/local/bin/uv
WORKDIR /app/apps/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev
COPY apps/api ./
COPY content /app/content
RUN useradd --create-home yara && chown -R yara /app
USER yara
ENV PATH="/app/apps/api/.venv/bin:$PATH" YARA_CONTENT_DIR=/app/content
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m yara_api.cli seed && uvicorn yara_api.main:create_app --factory --host 0.0.0.0 --port 8000 --proxy-headers"]

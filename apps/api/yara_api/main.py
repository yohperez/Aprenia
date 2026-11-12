from collections.abc import Callable
from datetime import datetime

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from yara_api.config import Settings, get_settings
from yara_api.db import Database, utcnow
from yara_api.packs import PackService
from yara_api.routers import accounts, content, progress, tutor
from yara_api.tutor.policies import PolicyIndex, load_policies
from yara_api.tutor.providers import TutorProvider, build_provider
from yara_api.tutor.service import TutorService

PRIVATE_PREFIXES = ("/v1/accounts", "/v1/me", "/v1/progress", "/v1/tutor")


def create_app(
    settings: Settings | None = None,
    database: Database | None = None,
    provider: TutorProvider | None = None,
    clock: Callable[[], datetime] = utcnow,
) -> FastAPI:
    settings = settings or get_settings()
    database = database or Database(settings.database_url)
    policies = PolicyIndex(load_policies(settings.content_dir / "policy.json"))
    app = FastAPI(
        title="Yara API", version="0.1.0", docs_url="/docs" if settings.environment != "production" else None
    )
    app.state.settings = settings
    app.state.database = database
    app.state.clock = clock
    app.state.packs = PackService()
    app.state.policies = policies
    app.state.tutor = TutorService(settings, provider or build_provider(settings), policies)

    app.add_middleware(GZipMiddleware, minimum_size=512)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "If-None-Match"],
        expose_headers=["ETag"],
        max_age=86400,
    )

    @app.middleware("http")
    async def private_responses(request: Request, call_next) -> Response:
        response = await call_next(request)
        if request.url.path.startswith(PRIVATE_PREFIXES):
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for module in (accounts, progress, content, tutor):
        app.include_router(module.router)
    return app

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from yara_api.config import REPO_ROOT, Settings
from yara_api.content_store import load_bundle, seed_content
from yara_api.db import Database
from yara_api.main import create_app
from yara_api.tutor.providers import ScriptedProvider

CONTENT_DIR = REPO_ROOT / "content"


class FakeClock:
    def __init__(self) -> None:
        self.current = datetime(2026, 11, 12, 10, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.current

    def advance(self, **delta: float) -> None:
        self.current += timedelta(**delta)


@pytest.fixture(scope="session")
def bundle():
    return load_bundle(CONTENT_DIR)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        environment="test",
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        content_dir=CONTENT_DIR,
        recovery_pepper="test-pepper-test-pepper-test-pepper",
        tutor_provider="none",
    )


@pytest.fixture
def database(settings: Settings, bundle) -> Database:
    database = Database(settings.database_url)
    database.create_all()
    with database.session_factory() as session:
        seed_content(session, bundle)
    return database


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def provider() -> ScriptedProvider:
    return ScriptedProvider(lambda prompt: reply(prompt.context.must_mention or "Muy bien"))


@pytest.fixture
def app(settings: Settings, database: Database, provider: ScriptedProvider, clock: FakeClock):
    return create_app(settings=settings, database=database, provider=provider, clock=clock)


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app)


def reply(answer: str, on_topic: bool = True) -> str:
    return json.dumps({"answer": answer, "on_topic": on_topic}, ensure_ascii=False)


def create_guest(client: TestClient, locale: str = "es") -> dict:
    response = client.post("/v1/accounts/guest", json={"locale": locale})
    assert response.status_code == 201, response.text
    return response.json()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

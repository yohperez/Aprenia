from datetime import timedelta

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from tests.conftest import auth, create_guest
from yara_api.audio import AzureSpeech, generate_audio
from yara_api.config import Settings
from yara_api.main import create_app
from yara_api.maintenance import purge
from yara_api.models import AuthSession, ContentAudio, RateLimitHit, TutorEvent


def fake_speech(calls: list[str]) -> AzureSpeech:
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.content.decode())
        assert request.headers["Ocp-Apim-Subscription-Key"] == "key"
        return httpx.Response(200, content=b"ID3fake-mp3")

    return AzureSpeech("key", "westeurope", httpx.Client(transport=httpx.MockTransport(handler)))


def test_audio_is_generated_once_and_served_with_long_cache(client, database, bundle):
    calls: list[str] = []
    with database.session_factory() as db:
        created = generate_audio(db, bundle, fake_speech(calls), ["ur"])
        assert created == 256 + 18
        assert generate_audio(db, bundle, fake_speech(calls), ["ur"]) == 0
    assert "ur-PK-UzmaNeural" in calls[0] and "&" not in calls[0].replace("&amp;", "")
    response = client.get("/v1/audio/ur/apple")
    assert response.status_code == 200 and response.content == b"ID3fake-mp3"
    assert "immutable" in response.headers["cache-control"]
    pack = client.get("/v1/packs/ur").json()
    assert pack["audio"]["apple"] and len(pack["audio"]) == 274
    assert client.get("/v1/audio/es/apple").status_code == 404


def test_ssml_escapes_text():
    calls: list[str] = []
    fake_speech(calls).synthesize("<b>Tom & Jerry</b>", "en")
    assert "&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;" in calls[0]


def test_purge_removes_expired_data(client, database, settings, clock):
    guest = create_guest(client)
    client.patch("/v1/me", json={"age_band": "5-9"}, headers=auth(guest["token"]))
    with database.session_factory() as db:
        db.add(
            TutorEvent(
                account_id=guest["account_id"],
                lesson_id="language-1",
                mode="preset",
                intent="explain",
                status="ok",
                reason=None,
                policy_ids=[],
                created_at=clock() - timedelta(days=settings.tutor_event_retention_days + 1),
            )
        )
        db.commit()
        report = purge(db, settings, clock() + timedelta(days=settings.session_days + 1))
        assert report.tutor_events == 1 and report.sessions == 1 and report.rate_limit_hits >= 1
        assert db.scalar(select(func.count()).select_from(TutorEvent)) == 0
        assert db.scalar(select(func.count()).select_from(AuthSession)) == 0
        assert db.scalar(select(func.count()).select_from(RateLimitHit)) == 0


def test_content_change_drops_stale_audio(database, bundle):
    from dataclasses import replace

    from yara_api.content_store import seed_content

    calls: list[str] = []
    with database.session_factory() as db:
        generate_audio(db, bundle, fake_speech(calls), ["es"])
        locales = {
            **bundle.locales,
            "es": {**bundle.locales["es"], "words": {**bundle.locales["es"]["words"], "apple": "manzanita"}},
        }
        seed_content(db, replace(bundle, locales=locales, version="changed"))
        assert db.get(ContentAudio, ("es", "apple")) is None
        assert db.get(ContentAudio, ("es", "banana")) is not None


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_postgres_urls_from_hosting_providers_use_psycopg():
    settings = Settings(database_url="postgres://user:secret@db:5432/yara")
    assert settings.database_url == "postgresql+psycopg://user:secret@db:5432/yara"


def test_web_build_is_served_next_to_the_api(tmp_path, settings, database, provider, clock):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>Yara</title>")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    app = create_app(
        settings=settings.model_copy(update={"web_dir": tmp_path}),
        database=database,
        provider=provider,
        clock=clock,
    )
    client = TestClient(app)
    home = client.get("/")
    assert home.status_code == 200 and "Yara" in home.text
    assert home.headers["cache-control"] == "no-cache"
    assert "immutable" in client.get("/assets/app.js").headers["cache-control"]
    assert client.get("/health").json() == {"status": "ok"}

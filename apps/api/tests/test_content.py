import json
import shutil
import unicodedata

import pytest

from tests.conftest import CONTENT_DIR
from yara_api.content_store import ContentError, load_bundle, seed_content
from yara_api.domain import LOCALES, RECOVERY_WORDLIST_SIZE


def test_bundle_has_every_locale_complete(bundle):
    assert len(bundle.concepts) == RECOVERY_WORDLIST_SIZE
    for locale in LOCALES:
        words = bundle.locales[locale]["words"]
        assert len(words) == RECOVERY_WORDLIST_SIZE
        normalized = [unicodedata.normalize("NFKC", w).casefold() for w in words.values()]
        assert len(set(normalized)) == RECOVERY_WORDLIST_SIZE, locale


def test_content_has_no_long_dashes(bundle):
    raw = json.dumps(bundle.locales, ensure_ascii=False)
    assert chr(0x2014) not in raw and chr(0x2013) not in raw


def test_every_live_subject_has_one_live_lesson_per_level(bundle):
    live = {s["id"] for s in bundle.subjects if s["status"] == "live"}
    assert live == {"language", "math", "technology"}
    for subject in live:
        lessons = [
            lesson
            for lesson in bundle.lessons
            if lesson["subject"] == subject and lesson.get("status", "live") == "live"
        ]
        assert [lesson["level"] for lesson in lessons] == list(range(1, len(lessons) + 1))
        assert len(lessons) >= 6
        assert all(lesson["id"] == f"{subject}-{lesson['level']}" for lesson in lessons)
        upcoming = [
            lesson
            for lesson in bundle.lessons
            if lesson["subject"] == subject and lesson.get("status") == "soon"
        ]
        assert upcoming and min(lesson["level"] for lesson in upcoming) > len(lessons)


def test_quiz_questions_have_texts_in_active_languages(bundle):
    for question in bundle.questions:
        for locale in ("es", "ar", "en"):
            text = bundle.locales[locale]["questions"][question["id"]]
            assert text["prompt"].strip() and len(text["options"]) == 3


def test_resources_are_youtube_links_for_every_live_subject(bundle):
    for subject in ("language", "math", "technology"):
        for locale in ("es", "ar", "en"):
            links = [r for r in bundle.resources if r["subject"] == subject and r["locale"] == locale]
            assert links and all(r["url"].startswith("https://www.youtube.com/") for r in links)


def test_seeding_twice_is_a_no_op(database, bundle):
    with database.session_factory() as session:
        assert seed_content(session, bundle) is False


def test_incomplete_content_is_rejected(tmp_path):
    target = tmp_path / "content"
    target.mkdir()
    for name in ("concepts.json", "statements.json", "curriculum.json"):
        (target / name).write_text((CONTENT_DIR / name).read_text())
    (target / "locales").mkdir()
    (target / "images").mkdir()
    with pytest.raises(ContentError):
        load_bundle(target)


def test_pack_contains_everything_for_offline_use(client):
    response = client.get("/v1/packs/ur")
    assert response.status_code == 200
    pack = response.json()
    assert pack["locale"] == "ur" and pack["rtl"] is True
    assert len(pack["concepts"]) == RECOVERY_WORDLIST_SIZE
    assert pack["concepts"][0] == {"id": "dog", "category": "animals", "image": "1f436", "word": "کتا"}
    assert {s["id"] for s in pack["subjects"] if s["status"] == "live"} == {"language", "math", "technology"}
    assert len([lesson for lesson in pack["lessons"] if lesson["status"] == "live"]) == 19
    lesson_items = {
        item for lesson in pack["lessons"] if lesson["kind"] == "vocabulary" for item in lesson["items"]
    }
    lesson_images = {c["image"] for c in pack["concepts"] if c["id"] in lesson_items}
    assert lesson_images <= set(pack["images"])
    assert len(pack["images"]) < 70
    assert len(pack["statements"]) == 18
    assert len(pack["questions"]) == 24 and {q["locale"] for q in pack["questions"]} == {"en"}
    assert {r["locale"] for r in pack["resources"]} == {"en"}
    assert len(pack["policies"]) == 20


def test_pack_uses_the_learner_language_when_available(client):
    pack = client.get("/v1/packs/ar").json()
    assert {q["locale"] for q in pack["questions"]} == {"ar"}
    assert {r["locale"] for r in pack["resources"]} == {"ar"}
    assert {r["subject"] for r in pack["resources"]} == {"language", "math", "technology"}


def test_non_youtube_resources_are_rejected(tmp_path):
    target = tmp_path / "content"
    shutil.copytree(CONTENT_DIR, target)
    data = json.loads((target / "resources.json").read_text())
    data["resources"][0]["url"] = "https://example.com/video"
    (target / "resources.json").write_text(json.dumps(data))
    with pytest.raises(ContentError):
        load_bundle(target)


def test_pack_is_compressed_and_cacheable(client):
    response = client.get("/v1/packs/es", headers={"Accept-Encoding": "gzip"})
    assert response.headers["content-encoding"] == "gzip"
    assert "max-age" in response.headers["cache-control"]
    etag = response.headers["etag"]
    cached = client.get("/v1/packs/es", headers={"If-None-Match": etag})
    assert cached.status_code == 304


def test_pack_for_unknown_locale_is_rejected(client):
    assert client.get("/v1/packs/de").status_code == 422


def test_pack_stays_small_for_slow_connections(client):
    response = client.get("/v1/packs/es", headers={"Accept-Encoding": "gzip"})
    assert int(response.headers["content-length"]) < 30_000


def test_images_outside_the_pack_load_one_by_one(client):
    response = client.get("/v1/images/1f6f8.svg")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert "immutable" in response.headers["cache-control"]
    assert client.get("/v1/images/zzz.svg").status_code == 422
    assert client.get("/v1/images/ffff.svg").status_code == 404

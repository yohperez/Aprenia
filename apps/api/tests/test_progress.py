from datetime import UTC, datetime

from tests.conftest import auth, create_guest
from yara_api.progress import LessonRecord, SubjectRecord, merge_lesson, merge_subject

EARLY = datetime(2026, 11, 1, tzinfo=UTC)
LATE = datetime(2026, 11, 2, tzinfo=UTC)


def lesson(**changes):
    base = {
        "lesson_id": "math-1",
        "completed": False,
        "best_score": 40,
        "attempts": 1,
        "updated_at": EARLY.isoformat(),
    }
    return base | changes


def test_merge_lesson_keeps_the_best_of_both():
    current = LessonRecord("math-1", "math", True, 80, 2, EARLY)
    incoming = LessonRecord("math-1", "math", False, 60, 3, LATE)
    assert merge_lesson(current, incoming) == LessonRecord("math-1", "math", True, 80, 3, LATE)


def test_merge_subject_keeps_the_newest_level():
    older = SubjectRecord("math", 4, "test", EARLY)
    newer = SubjectRecord("math", 2, "zero", LATE)
    assert merge_subject(older, newer) == newer
    assert merge_subject(newer, older) == newer


def test_progress_round_trip(client):
    token = create_guest(client)["token"]
    body = {
        "subjects": [
            {"subject_id": "math", "level": 3, "placement": "test", "updated_at": EARLY.isoformat()}
        ],
        "lessons": [lesson(), lesson(lesson_id="math-3", completed=True, best_score=100)],
    }
    assert client.put("/v1/progress", json=body, headers=auth(token)).status_code == 200
    snapshot = client.get("/v1/progress", headers=auth(token)).json()
    assert snapshot["subjects"][0]["level"] == 3
    assert {item["lesson_id"] for item in snapshot["lessons"]} == {"math-1", "math-3"}


def test_progress_from_two_phones_is_merged(client):
    token = create_guest(client)["token"]
    client.put("/v1/progress", json={"lessons": [lesson(completed=True, best_score=90)]}, headers=auth(token))
    client.put(
        "/v1/progress",
        json={"lessons": [lesson(best_score=50, attempts=4, updated_at=LATE.isoformat())]},
        headers=auth(token),
    )
    stored = client.get("/v1/progress", headers=auth(token)).json()["lessons"][0]
    assert (stored["completed"], stored["best_score"], stored["attempts"]) == (True, 90, 4)


def test_future_timestamps_cannot_win_forever(client, clock):
    token = create_guest(client)["token"]
    future = {"subject_id": "math", "level": 5, "placement": "test", "updated_at": "2099-01-01T00:00:00Z"}
    client.put("/v1/progress", json={"subjects": [future]}, headers=auth(token))
    clock.advance(minutes=1)
    later = {"subject_id": "math", "level": 2, "placement": "zero", "updated_at": clock().isoformat()}
    snapshot = client.put("/v1/progress", json={"subjects": [later]}, headers=auth(token)).json()
    assert snapshot["subjects"][0]["level"] == 2


def test_unknown_or_locked_items_are_rejected(client):
    token = create_guest(client)["token"]
    locked = {"subject_id": "history", "level": 1, "placement": "zero", "updated_at": EARLY.isoformat()}
    assert client.put("/v1/progress", json={"subjects": [locked]}, headers=auth(token)).status_code == 422
    unknown = lesson(lesson_id="math-9")
    assert client.put("/v1/progress", json={"lessons": [unknown]}, headers=auth(token)).status_code == 422
    assert (
        client.put(
            "/v1/progress", json={"lessons": [lesson(best_score=101)]}, headers=auth(token)
        ).status_code
        == 422
    )


def test_progress_is_private_to_each_account(client):
    first = create_guest(client)["token"]
    second = create_guest(client)["token"]
    client.put("/v1/progress", json={"lessons": [lesson()]}, headers=auth(first))
    assert client.get("/v1/progress", headers=auth(second)).json()["lessons"] == []


def test_coming_soon_lessons_cannot_store_progress(client):
    token = create_guest(client)["token"]
    upcoming = lesson(lesson_id="technology-7")
    assert client.put("/v1/progress", json={"lessons": [upcoming]}, headers=auth(token)).status_code == 422

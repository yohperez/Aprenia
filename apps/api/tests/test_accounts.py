from sqlalchemy import select

from tests.conftest import auth, create_guest
from yara_api.models import Account, AuthSession


def test_guest_gets_six_random_words_and_a_working_token(client):
    guest = create_guest(client)
    assert len(guest["recovery_words"]) == 6
    assert all(0 <= word < 256 for word in guest["recovery_words"])
    me = client.get("/v1/me", headers=auth(guest["token"]))
    assert me.status_code == 200
    assert me.json() == {"locale": "es", "age_band": None, "goal": None}


def test_guests_get_different_words(client):
    words = {tuple(create_guest(client)["recovery_words"]) for _ in range(5)}
    assert len(words) == 5


def test_words_and_tokens_are_never_stored_in_clear(client, database):
    guest = create_guest(client)
    with database.session_factory() as db:
        account = db.get(Account, guest["account_id"])
        session = db.scalar(select(AuthSession))
    plain = "-".join(str(w) for w in guest["recovery_words"])
    assert plain not in account.recovery_lookup and len(account.recovery_lookup) == 64
    assert session.token_hash != guest["token"]


def test_recovery_with_the_six_words_returns_the_same_account(client):
    guest = create_guest(client)
    client.patch("/v1/me", json={"age_band": "40-44", "goal": "resume_studies"}, headers=auth(guest["token"]))
    response = client.post("/v1/accounts/recover", json={"words": guest["recovery_words"]})
    assert response.status_code == 200
    body = response.json()
    assert body["account_id"] == guest["account_id"]
    assert body["token"] != guest["token"]
    assert body["profile"]["age_band"] == "40-44"


def test_wrong_words_are_rejected(client):
    guest = create_guest(client)
    wrong = [(w + 1) % 256 for w in guest["recovery_words"]]
    assert client.post("/v1/accounts/recover", json={"words": wrong}).status_code == 401


def test_recovery_needs_exactly_six_valid_words(client):
    assert client.post("/v1/accounts/recover", json={"words": [1, 2, 3]}).status_code == 422
    assert client.post("/v1/accounts/recover", json={"words": [1, 2, 3, 4, 5, 256]}).status_code == 422


def test_recovery_attempts_are_rate_limited(client, settings, clock):
    for _ in range(settings.recover_limit):
        assert client.post("/v1/accounts/recover", json={"words": [0] * 6}).status_code == 401
    assert client.post("/v1/accounts/recover", json={"words": [0] * 6}).status_code == 429
    clock.advance(seconds=settings.recover_window_seconds)
    assert client.post("/v1/accounts/recover", json={"words": [0] * 6}).status_code == 401


def test_profile_accepts_every_five_year_band(client):
    guest = create_guest(client)
    for band in ("5-9", "25-29", "45-49", "80+"):
        response = client.patch("/v1/me", json={"age_band": band}, headers=auth(guest["token"]))
        assert response.json()["age_band"] == band
    assert client.patch("/v1/me", json={"age_band": "6-9"}, headers=auth(guest["token"])).status_code == 422


def test_requests_without_a_valid_token_are_rejected(client):
    assert client.get("/v1/me").status_code == 401
    assert client.get("/v1/me", headers=auth("nope")).status_code == 401


def test_sessions_expire(client, settings, clock):
    guest = create_guest(client)
    clock.advance(days=settings.session_days)
    assert client.get("/v1/me", headers=auth(guest["token"])).status_code == 401


def test_delete_me_removes_the_account(client):
    guest = create_guest(client)
    assert client.delete("/v1/me", headers=auth(guest["token"])).status_code == 204
    assert client.get("/v1/me", headers=auth(guest["token"])).status_code == 401
    assert client.post("/v1/accounts/recover", json={"words": guest["recovery_words"]}).status_code == 401


def test_private_responses_are_not_cached(client):
    guest = create_guest(client)
    assert client.get("/v1/me", headers=auth(guest["token"])).headers["cache-control"] == "no-store"

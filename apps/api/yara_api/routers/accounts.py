import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from yara_api.config import Settings
from yara_api.deps import AppSettings, ClientFingerprint, CurrentAccount, DbSession, Now
from yara_api.models import Account, AuthSession
from yara_api.ratelimit import consume
from yara_api.schemas import (
    GuestRequest,
    GuestResponse,
    Profile,
    ProfileUpdate,
    RecoverRequest,
    SessionResponse,
)
from yara_api.security import (
    generate_recovery_words,
    hash_token,
    new_session_token,
    recovery_lookup,
)

router = APIRouter(prefix="/v1", tags=["accounts"])
MAX_GENERATION_ATTEMPTS = 8


def profile_of(account: Account) -> Profile:
    return Profile(locale=account.locale, age_band=account.age_band, goal=account.goal)


def open_session(db: Session, account: Account, settings: Settings, now: datetime) -> str:
    token = new_session_token()
    db.add(
        AuthSession(
            token_hash=hash_token(token),
            account_id=account.id,
            created_at=now,
            expires_at=now + timedelta(days=settings.session_days),
        )
    )
    return token


@router.post("/accounts/guest", status_code=status.HTTP_201_CREATED)
def create_guest(
    body: GuestRequest, db: DbSession, settings: AppSettings, now: Now, client: ClientFingerprint
) -> GuestResponse:
    if not consume(db, f"guest:{client}", settings.guest_limit, settings.guest_window_seconds, now):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many new guests")
    for _ in range(MAX_GENERATION_ATTEMPTS):
        words = generate_recovery_words()
        lookup = recovery_lookup(words, settings.recovery_pepper)
        if db.scalar(select(Account.id).where(Account.recovery_lookup == lookup)) is None:
            break
    else:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Try again")
    account = Account(
        id=str(uuid.uuid4()),
        recovery_lookup=lookup,
        locale=body.locale,
        created_at=now,
        last_seen_at=now,
    )
    db.add(account)
    db.flush()
    token = open_session(db, account, settings, now)
    db.commit()
    return GuestResponse(
        account_id=account.id, token=token, profile=profile_of(account), recovery_words=words
    )


@router.post("/accounts/recover")
def recover(
    body: RecoverRequest, db: DbSession, settings: AppSettings, now: Now, client: ClientFingerprint
) -> SessionResponse:
    if not consume(db, f"recover:{client}", settings.recover_limit, settings.recover_window_seconds, now):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts")
    lookup = recovery_lookup(body.words, settings.recovery_pepper)
    account = db.scalar(select(Account).where(Account.recovery_lookup == lookup))
    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown words")
    account.last_seen_at = now
    token = open_session(db, account, settings, now)
    db.commit()
    return SessionResponse(account_id=account.id, token=token, profile=profile_of(account))


@router.get("/me")
def read_me(account: CurrentAccount) -> Profile:
    return profile_of(account)


@router.patch("/me")
def update_me(body: ProfileUpdate, account: CurrentAccount, db: DbSession) -> Profile:
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(account, field, value)
    db.commit()
    return profile_of(account)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(account: CurrentAccount, db: DbSession) -> Response:
    db.execute(delete(AuthSession).where(AuthSession.account_id == account.id))
    db.delete(account)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

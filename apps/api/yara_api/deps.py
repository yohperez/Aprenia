from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from yara_api.config import Settings
from yara_api.models import Account, AuthSession
from yara_api.security import anonymize_client, hash_token

LAST_SEEN_RESOLUTION = timedelta(hours=1)


def get_db(request: Request) -> Iterator[Session]:
    yield from request.app.state.database.session()


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_now(request: Request) -> datetime:
    return request.app.state.clock()


DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]
Now = Annotated[datetime, Depends(get_now)]


def client_fingerprint(request: Request, settings: AppSettings) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if settings.trust_proxy_headers and forwarded:
        address = forwarded.split(",")[0].strip()
    else:
        address = request.client.host if request.client else "unknown"
    return anonymize_client(address)


ClientFingerprint = Annotated[str, Depends(client_fingerprint)]


def current_account(
    db: DbSession,
    now: Now,
    authorization: Annotated[str | None, Header()] = None,
) -> Account:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    session = db.get(AuthSession, hash_token(token))
    if session is None or session.expires_at <= now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    account = db.get(Account, session.account_id)
    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    if now - account.last_seen_at >= LAST_SEEN_RESOLUTION:
        account.last_seen_at = now
        db.commit()
    return account


CurrentAccount = Annotated[Account, Depends(current_account)]

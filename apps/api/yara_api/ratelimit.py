from datetime import UTC, datetime

from sqlalchemy.orm import Session

from yara_api.models import RateLimitHit


def window_start(now: datetime, window_seconds: int) -> datetime:
    epoch = int(now.timestamp())
    return datetime.fromtimestamp(epoch - epoch % window_seconds, UTC)


def consume(session: Session, key: str, limit: int, window_seconds: int, now: datetime) -> bool:
    start = window_start(now, window_seconds)
    hit = session.get(RateLimitHit, (key, start))
    if hit is None:
        hit = RateLimitHit(key=key, window_start=start, count=0)
        session.add(hit)
    hit.count += 1
    session.commit()
    return hit.count <= limit

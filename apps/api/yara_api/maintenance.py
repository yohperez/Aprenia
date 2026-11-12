from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from yara_api.config import Settings
from yara_api.models import AuthSession, RateLimitHit, TutorEvent, TutorUsage

RATE_LIMIT_RETENTION = timedelta(days=1)
USAGE_RETENTION = timedelta(days=7)


@dataclass(frozen=True)
class PurgeReport:
    tutor_events: int
    sessions: int
    rate_limit_hits: int
    tutor_usage: int


def purge(db: Session, settings: Settings, now: datetime) -> PurgeReport:
    event_cutoff = now - timedelta(days=settings.tutor_event_retention_days)
    report = PurgeReport(
        tutor_events=db.execute(delete(TutorEvent).where(TutorEvent.created_at < event_cutoff)).rowcount,
        sessions=db.execute(delete(AuthSession).where(AuthSession.expires_at <= now)).rowcount,
        rate_limit_hits=db.execute(
            delete(RateLimitHit).where(RateLimitHit.window_start < now - RATE_LIMIT_RETENTION)
        ).rowcount,
        tutor_usage=db.execute(
            delete(TutorUsage).where(TutorUsage.day < (now - USAGE_RETENTION).date())
        ).rowcount,
    )
    db.commit()
    return report

from dataclasses import dataclass, replace
from datetime import datetime


@dataclass(frozen=True)
class SubjectRecord:
    subject_id: str
    level: int
    placement: str
    updated_at: datetime


@dataclass(frozen=True)
class LessonRecord:
    lesson_id: str
    subject_id: str
    completed: bool
    best_score: int
    attempts: int
    updated_at: datetime


def clamp_to_now[T: (SubjectRecord, LessonRecord)](record: T, now: datetime) -> T:
    return replace(record, updated_at=min(record.updated_at, now))


def merge_subject(current: SubjectRecord | None, incoming: SubjectRecord) -> SubjectRecord:
    if current is None or incoming.updated_at > current.updated_at:
        return incoming
    return current


def merge_lesson(current: LessonRecord | None, incoming: LessonRecord) -> LessonRecord:
    if current is None:
        return incoming
    return LessonRecord(
        lesson_id=current.lesson_id,
        subject_id=current.subject_id,
        completed=current.completed or incoming.completed,
        best_score=max(current.best_score, incoming.best_score),
        attempts=max(current.attempts, incoming.attempts),
        updated_at=max(current.updated_at, incoming.updated_at),
    )

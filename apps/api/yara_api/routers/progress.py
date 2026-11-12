from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from yara_api.deps import CurrentAccount, DbSession, Now
from yara_api.models import Account, ContentLesson, ContentSubject, LessonProgress, SubjectProgress
from yara_api.progress import LessonRecord, SubjectRecord, clamp_to_now, merge_lesson, merge_subject
from yara_api.routers.accounts import profile_of
from yara_api.schemas import LessonProgressItem, ProgressSnapshot, ProgressUpdate, SubjectProgressItem

router = APIRouter(prefix="/v1", tags=["progress"])


@router.get("/progress")
def read_progress(account: CurrentAccount, db: DbSession) -> ProgressSnapshot:
    return snapshot(db, account)


@router.put("/progress")
def write_progress(
    body: ProgressUpdate, account: CurrentAccount, db: DbSession, now: Now
) -> ProgressSnapshot:
    live_subjects = set(db.scalars(select(ContentSubject.id).where(ContentSubject.status == "live")))
    lesson_subjects = dict(db.execute(select(ContentLesson.id, ContentLesson.subject_id)).all())
    for item in body.subjects:
        if item.subject_id not in live_subjects:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown subject {item.subject_id}")
        incoming = clamp_to_now(SubjectRecord(**item.model_dump()), now)
        row = db.get(SubjectProgress, (account.id, item.subject_id))
        merged = merge_subject(_subject_record(row) if row else None, incoming)
        _store_subject(db, account, row, merged)
    for item in body.lessons:
        subject_id = lesson_subjects.get(item.lesson_id)
        if subject_id is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown lesson {item.lesson_id}")
        incoming = clamp_to_now(LessonRecord(subject_id=subject_id, **item.model_dump()), now)
        row = db.get(LessonProgress, (account.id, item.lesson_id))
        merged = merge_lesson(_lesson_record(row) if row else None, incoming)
        _store_lesson(db, account, row, merged)
    db.commit()
    return snapshot(db, account)


def snapshot(db: Session, account: Account) -> ProgressSnapshot:
    subjects = db.scalars(
        select(SubjectProgress)
        .where(SubjectProgress.account_id == account.id)
        .order_by(SubjectProgress.subject_id)
    ).all()
    lessons = db.scalars(
        select(LessonProgress)
        .where(LessonProgress.account_id == account.id)
        .order_by(LessonProgress.lesson_id)
    ).all()
    return ProgressSnapshot(
        profile=profile_of(account),
        subjects=[
            SubjectProgressItem(
                subject_id=s.subject_id, level=s.level, placement=s.placement, updated_at=s.updated_at
            )
            for s in subjects
        ],
        lessons=[
            LessonProgressItem(
                lesson_id=lesson.lesson_id,
                completed=lesson.completed,
                best_score=lesson.best_score,
                attempts=lesson.attempts,
                updated_at=lesson.updated_at,
            )
            for lesson in lessons
        ],
    )


def _subject_record(row: SubjectProgress) -> SubjectRecord:
    return SubjectRecord(row.subject_id, row.level, row.placement, row.updated_at)


def _lesson_record(row: LessonProgress) -> LessonRecord:
    return LessonRecord(
        row.lesson_id, row.subject_id, row.completed, row.best_score, row.attempts, row.updated_at
    )


def _store_subject(db: Session, account: Account, row: SubjectProgress | None, record: SubjectRecord) -> None:
    if row is None:
        db.add(SubjectProgress(account_id=account.id, **record.__dict__))
        return
    row.level, row.placement, row.updated_at = record.level, record.placement, record.updated_at


def _store_lesson(db: Session, account: Account, row: LessonProgress | None, record: LessonRecord) -> None:
    if row is None:
        db.add(LessonProgress(account_id=account.id, **record.__dict__))
        return
    row.completed, row.best_score = record.completed, record.best_score
    row.attempts, row.updated_at = record.attempts, record.updated_at

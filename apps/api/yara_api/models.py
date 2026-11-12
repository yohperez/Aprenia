from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from yara_api.db import Base, UTCDateTime


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    recovery_lookup: Mapped[str] = mapped_column(String(64), unique=True)
    locale: Mapped[str] = mapped_column(String(8))
    age_band: Mapped[str | None] = mapped_column(String(8))
    goal: Mapped[str | None] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime())
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime())


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime())
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)


class SubjectProgress(Base):
    __tablename__ = "subject_progress"

    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    subject_id: Mapped[str] = mapped_column(String(24), primary_key=True)
    level: Mapped[int] = mapped_column(SmallInteger)
    placement: Mapped[str] = mapped_column(String(8))
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime())


class LessonProgress(Base):
    __tablename__ = "lesson_progress"

    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    lesson_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    subject_id: Mapped[str] = mapped_column(String(24))
    completed: Mapped[bool] = mapped_column(Boolean)
    best_score: Mapped[int] = mapped_column(SmallInteger)
    attempts: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime())


class RateLimitHit(Base):
    __tablename__ = "rate_limit_hits"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(UTCDateTime(), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)


class TutorUsage(Base):
    __tablename__ = "tutor_usage"

    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    mode: Mapped[str] = mapped_column(String(8), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)


class TutorEvent(Base):
    __tablename__ = "tutor_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"), index=True)
    lesson_id: Mapped[str] = mapped_column(String(40))
    mode: Mapped[str] = mapped_column(String(8))
    intent: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16))
    reason: Mapped[str | None] = mapped_column(String(40))
    policy_ids: Mapped[list[str]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)


class ContentMeta(Base):
    __tablename__ = "content_meta"

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    value: Mapped[str] = mapped_column(String(128))


class ContentImage(Base):
    __tablename__ = "content_images"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    svg: Mapped[str] = mapped_column(Text)


class ContentConcept(Base):
    __tablename__ = "content_concepts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    position: Mapped[int] = mapped_column(SmallInteger, unique=True)
    category: Mapped[str] = mapped_column(String(16))
    image: Mapped[str] = mapped_column(ForeignKey("content_images.name"))


class ContentWord(Base):
    __tablename__ = "content_words"

    concept_id: Mapped[str] = mapped_column(
        ForeignKey("content_concepts.id", ondelete="CASCADE"), primary_key=True
    )
    locale: Mapped[str] = mapped_column(String(8), primary_key=True)
    word: Mapped[str] = mapped_column(String(64))


class ContentStatement(Base):
    __tablename__ = "content_statements"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    position: Mapped[int] = mapped_column(SmallInteger)
    set_name: Mapped[str] = mapped_column(String(16))
    safe: Mapped[bool] = mapped_column(Boolean)


class ContentStatementText(Base):
    __tablename__ = "content_statement_texts"

    statement_id: Mapped[str] = mapped_column(
        ForeignKey("content_statements.id", ondelete="CASCADE"), primary_key=True
    )
    locale: Mapped[str] = mapped_column(String(8), primary_key=True)
    text: Mapped[str] = mapped_column(String(240))


class ContentSubject(Base):
    __tablename__ = "content_subjects"

    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    status: Mapped[str] = mapped_column(String(8))
    image: Mapped[str] = mapped_column(ForeignKey("content_images.name"))
    position: Mapped[int] = mapped_column(SmallInteger)


class ContentLesson(Base):
    __tablename__ = "content_lessons"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    subject_id: Mapped[str] = mapped_column(ForeignKey("content_subjects.id", ondelete="CASCADE"))
    level: Mapped[int] = mapped_column(SmallInteger)
    position: Mapped[int] = mapped_column(SmallInteger)
    kind: Mapped[str] = mapped_column(String(16))
    items: Mapped[list[str]] = mapped_column(JSON)
    math: Mapped[dict | None] = mapped_column(JSON)


class ContentAudio(Base):
    __tablename__ = "content_audio"

    locale: Mapped[str] = mapped_column(String(8), primary_key=True)
    item_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    mime: Mapped[str] = mapped_column(String(32))
    digest: Mapped[str] = mapped_column(String(16))
    data: Mapped[bytes] = mapped_column(LargeBinary)


Index("ix_content_lessons_subject_level", ContentLesson.subject_id, ContentLesson.level)

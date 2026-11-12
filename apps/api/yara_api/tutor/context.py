from dataclasses import dataclass

from sqlalchemy.orm import Session

from yara_api.maths import allowed, answer_of, describe, parse_item
from yara_api.models import (
    ContentLesson,
    ContentQuestion,
    ContentQuestionText,
    ContentStatement,
    ContentStatementText,
    ContentWord,
)
from yara_api.text import fold


@dataclass(frozen=True)
class LessonContext:
    lesson_id: str
    subject: str
    level: int
    kind: str
    item_id: str
    facts: str
    terms: frozenset[str]
    must_mention: str | None


def build_context(db: Session, lesson_id: str, item_id: str, locale: str) -> LessonContext | None:
    lesson = db.get(ContentLesson, lesson_id)
    if lesson is None or lesson.status != "live":
        return None
    builder = {"vocabulary": _vocabulary, "safety": _safety, "math": _math, "quiz": _quiz}[lesson.kind]
    return builder(db, lesson, item_id, locale)


def _vocabulary(db: Session, lesson: ContentLesson, item_id: str, locale: str) -> LessonContext | None:
    if item_id not in lesson.items:
        return None
    word = db.get(ContentWord, (item_id, locale))
    english = db.get(ContentWord, (item_id, "en"))
    if word is None or english is None:
        return None
    facts = f"New word: {word.word}. It means: {english.word}. The lesson shows a picture of it."
    return LessonContext(
        lesson_id=lesson.id,
        subject=lesson.subject_id,
        level=lesson.level,
        kind=lesson.kind,
        item_id=item_id,
        facts=facts,
        terms=frozenset({fold(word.word), fold(english.word), item_id.replace("_", " ")}),
        must_mention=word.word,
    )


def _safety(db: Session, lesson: ContentLesson, item_id: str, locale: str) -> LessonContext | None:
    statement = db.get(ContentStatement, item_id)
    text = db.get(ContentStatementText, (item_id, locale))
    if item_id not in lesson.items or statement is None or text is None:
        return None
    verdict = "safe" if statement.safe else "not safe"
    facts = f"Situation: {text.text}. The correct answer is that this is {verdict}."
    terms = frozenset(fold(part) for part in text.text.split() if len(part) > 3)
    return LessonContext(lesson.id, lesson.subject_id, lesson.level, lesson.kind, item_id, facts, terms, None)


def _math(db: Session, lesson: ContentLesson, item_id: str, locale: str) -> LessonContext | None:
    item = parse_item(item_id)
    steps = (lesson.math or {}).get("steps") or []
    if item is None or not allowed(item, steps):
        return None
    terms = frozenset({str(item.a), str(answer_of(item)), "number", "count", "add", "plus", "minus", "times"})
    return LessonContext(
        lesson.id, lesson.subject_id, lesson.level, lesson.kind, item_id, describe(item), terms, None
    )


def _quiz(db: Session, lesson: ContentLesson, item_id: str, locale: str) -> LessonContext | None:
    question = db.get(ContentQuestion, item_id)
    text = db.get(ContentQuestionText, (item_id, locale)) or db.get(ContentQuestionText, (item_id, "en"))
    if item_id not in lesson.items or question is None or text is None:
        return None
    correct = text.options[question.answer]
    facts = f"Question: {text.prompt} Correct answer: {correct}."
    terms = frozenset(fold(part) for part in f"{text.prompt} {correct}".split() if len(part) > 3)
    return LessonContext(lesson.id, lesson.subject_id, lesson.level, lesson.kind, item_id, facts, terms, None)

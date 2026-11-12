import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from yara_api.models import ContentLesson, ContentStatement, ContentStatementText, ContentWord
from yara_api.text import fold

MATH_ITEM = re.compile(r"^(count|add|sub)-(\d{1,2})(?:-(\d{1,2}))?$")
SYMBOLS = {"add": "+", "sub": "-"}
OPERATION_SPECS = {"add": frozenset({"add", "mixed"}), "sub": frozenset({"subtract", "mixed"})}


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
    if lesson is None:
        return None
    builder = {"vocabulary": _vocabulary, "safety": _safety, "math": _math}[lesson.kind]
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
    match = MATH_ITEM.match(item_id)
    spec = lesson.math or {}
    if match is None:
        return None
    operation, first, second = match.group(1), int(match.group(2)), match.group(3)
    if not _allowed(operation, first, None if second is None else int(second), spec):
        return None
    if operation == "count":
        facts = f"The learner counts {first} pictures. The answer is {first}."
    else:
        b = int(second or 0)
        result = first + b if operation == "add" else first - b
        facts = f"Exercise: {first} {SYMBOLS[operation]} {b}. The answer is {result}."
    terms = frozenset({str(first), "count", "add", "plus", "minus", "number"})
    return LessonContext(lesson.id, lesson.subject_id, lesson.level, lesson.kind, item_id, facts, terms, None)


def _allowed(operation: str, a: int, b: int | None, spec: dict) -> bool:
    low, high, op = spec.get("min", 0), spec.get("max", 0), spec.get("op")
    if operation == "count":
        return op == "count" and b is None and max(low, 1) <= a <= high
    if b is None or op not in OPERATION_SPECS[operation]:
        return False
    if operation == "add":
        return low <= a and low <= b and a + b <= high
    return low <= b <= a <= high

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from yara_api.domain import LOCALES, MAX_LEVEL, RECOVERY_WORDLIST_SIZE
from yara_api.models import (
    ContentAudio,
    ContentConcept,
    ContentImage,
    ContentLesson,
    ContentMeta,
    ContentStatement,
    ContentStatementText,
    ContentSubject,
    ContentWord,
)

UNSAFE_SVG = re.compile(r"<script|\son\w+\s*=|javascript:|<foreignObject", re.IGNORECASE)
LESSON_KINDS = frozenset({"vocabulary", "safety", "math"})
MATH_OPERATIONS = frozenset({"count", "add", "subtract", "mixed"})


class ContentError(ValueError):
    pass


@dataclass(frozen=True)
class ContentBundle:
    concepts: list[dict]
    statements: list[dict]
    subjects: list[dict]
    lessons: list[dict]
    locales: dict[str, dict]
    images: dict[str, str]
    version: str


def text_digest(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def load_bundle(directory: Path) -> ContentBundle:
    concepts = _read(directory / "concepts.json")["concepts"]
    statements = _read(directory / "statements.json")["statements"]
    curriculum = _read(directory / "curriculum.json")
    locales = {locale: _read(directory / "locales" / f"{locale}.json") for locale in LOCALES}
    images = {path.stem: path.read_text().strip() for path in sorted((directory / "images").glob("*.svg"))}
    bundle_data = {
        "concepts": concepts,
        "statements": statements,
        "subjects": curriculum["subjects"],
        "lessons": curriculum["lessons"],
        "locales": locales,
        "images": images,
    }
    _validate(bundle_data)
    canonical = json.dumps(bundle_data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return ContentBundle(**bundle_data, version=text_digest(canonical))


def _read(path: Path) -> dict:
    if not path.exists():
        raise ContentError(f"Missing content file {path}")
    return json.loads(path.read_text())


def _validate(data: dict) -> None:
    concept_ids = [c["id"] for c in data["concepts"]]
    if len(concept_ids) != RECOVERY_WORDLIST_SIZE or len(set(concept_ids)) != RECOVERY_WORDLIST_SIZE:
        raise ContentError("concepts.json must contain 256 unique concepts")
    statement_ids = {s["id"] for s in data["statements"]}
    image_names = set(data["images"])
    for name, svg in data["images"].items():
        if not svg.startswith("<svg") or UNSAFE_SVG.search(svg):
            raise ContentError(f"Image {name} is not a safe SVG")
    for concept in data["concepts"]:
        if concept["image"] not in image_names:
            raise ContentError(f"Concept {concept['id']} has no image")
    subject_ids = {s["id"] for s in data["subjects"]}
    for subject in data["subjects"]:
        if subject["image"] not in image_names:
            raise ContentError(f"Subject {subject['id']} has no image")
    for locale, entries in data["locales"].items():
        words = entries.get("words", {})
        texts = entries.get("statements", {})
        missing_words = [cid for cid in concept_ids if not words.get(cid, "").strip()]
        missing_texts = [sid for sid in statement_ids if not texts.get(sid, "").strip()]
        if missing_words or missing_texts:
            raise ContentError(f"Locale {locale} is incomplete")
    for lesson in data["lessons"]:
        _validate_lesson(lesson, subject_ids, set(concept_ids), statement_ids)


def _validate_lesson(lesson: dict, subjects: set[str], concepts: set[str], statements: set[str]) -> None:
    if lesson["subject"] not in subjects or lesson["kind"] not in LESSON_KINDS:
        raise ContentError(f"Lesson {lesson['id']} has an invalid subject or kind")
    if not 1 <= lesson["level"] <= MAX_LEVEL:
        raise ContentError(f"Lesson {lesson['id']} has an invalid level")
    valid_items = {"vocabulary": concepts, "safety": statements, "math": set()}[lesson["kind"]]
    if any(item not in valid_items for item in lesson["items"]):
        raise ContentError(f"Lesson {lesson['id']} references unknown items")
    if lesson["kind"] == "math":
        spec = lesson.get("math") or {}
        if spec.get("op") not in MATH_OPERATIONS or not 0 <= spec["min"] < spec["max"] <= 20:
            raise ContentError(f"Lesson {lesson['id']} has an invalid math spec")
        if spec.get("object") and spec["object"] not in concepts:
            raise ContentError(f"Lesson {lesson['id']} uses an unknown math object")


def current_version(session: Session) -> str | None:
    meta = session.get(ContentMeta, "version")
    return meta.value if meta else None


def seed_content(session: Session, bundle: ContentBundle) -> bool:
    if current_version(session) == bundle.version:
        return False
    for model in (
        ContentLesson,
        ContentSubject,
        ContentStatementText,
        ContentStatement,
        ContentWord,
        ContentConcept,
        ContentImage,
    ):
        session.execute(delete(model))
    session.add_all(ContentImage(name=name, svg=svg) for name, svg in bundle.images.items())
    session.flush()
    session.add_all(
        ContentConcept(id=c["id"], position=i, category=c["category"], image=c["image"])
        for i, c in enumerate(bundle.concepts)
    )
    session.add_all(
        ContentStatement(id=s["id"], position=i, set_name=s["set"], safe=s["safe"])
        for i, s in enumerate(bundle.statements)
    )
    session.add_all(
        ContentSubject(id=s["id"], status=s["status"], image=s["image"], position=s["position"])
        for s in bundle.subjects
    )
    session.flush()
    for locale, entries in bundle.locales.items():
        session.add_all(
            ContentWord(concept_id=cid, locale=locale, word=word) for cid, word in entries["words"].items()
        )
        session.add_all(
            ContentStatementText(statement_id=sid, locale=locale, text=text)
            for sid, text in entries["statements"].items()
        )
    session.add_all(
        ContentLesson(
            id=lesson["id"],
            subject_id=lesson["subject"],
            level=lesson["level"],
            position=i,
            kind=lesson["kind"],
            items=lesson["items"],
            math=lesson.get("math"),
        )
        for i, lesson in enumerate(bundle.lessons)
    )
    _drop_stale_audio(session, bundle)
    meta = session.get(ContentMeta, "version")
    if meta:
        meta.value = bundle.version
    else:
        session.add(ContentMeta(key="version", value=bundle.version))
    session.commit()
    return True


def spoken_texts(bundle: ContentBundle, locale: str) -> dict[str, str]:
    entries = bundle.locales[locale]
    return {**entries["words"], **entries["statements"]}


def _drop_stale_audio(session: Session, bundle: ContentBundle) -> None:
    for audio in session.scalars(select(ContentAudio)).all():
        text = (
            spoken_texts(bundle, audio.locale).get(audio.item_id) if audio.locale in bundle.locales else None
        )
        if text is None or text_digest(text) != audio.digest:
            session.delete(audio)

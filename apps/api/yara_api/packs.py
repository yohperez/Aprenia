import json
from dataclasses import dataclass
from threading import Lock

from sqlalchemy import select
from sqlalchemy.orm import Session

from yara_api.content_store import current_version, text_digest
from yara_api.domain import RTL_LOCALES
from yara_api.models import (
    ContentAudio,
    ContentConcept,
    ContentImage,
    ContentLesson,
    ContentStatement,
    ContentStatementText,
    ContentSubject,
    ContentWord,
)


@dataclass(frozen=True)
class Pack:
    etag: str
    body: bytes


class PackService:
    def __init__(self) -> None:
        self._cache: dict[tuple[str, str, str], Pack] = {}
        self._lock = Lock()

    def get(self, session: Session, locale: str) -> Pack | None:
        version = current_version(session)
        if version is None:
            return None
        audio = {
            item_id: digest
            for item_id, digest in session.execute(
                select(ContentAudio.item_id, ContentAudio.digest).where(ContentAudio.locale == locale)
            )
        }
        audio_tag = text_digest("|".join(sorted(f"{k}:{v}" for k, v in audio.items())))
        key = (locale, version, audio_tag)
        with self._lock:
            cached = self._cache.get(key)
        if cached:
            return cached
        body = json.dumps(
            build_pack(session, locale, version, audio), ensure_ascii=False, separators=(",", ":")
        ).encode()
        pack = Pack(etag=f'"{version}-{locale}-{audio_tag}"', body=body)
        with self._lock:
            self._cache = {k: v for k, v in self._cache.items() if k[0] != locale}
            self._cache[key] = pack
        return pack

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


def build_pack(session: Session, locale: str, version: str, audio: dict[str, str]) -> dict:
    words = dict(
        session.execute(
            select(ContentWord.concept_id, ContentWord.word).where(ContentWord.locale == locale)
        ).all()
    )
    texts = dict(
        session.execute(
            select(ContentStatementText.statement_id, ContentStatementText.text).where(
                ContentStatementText.locale == locale
            )
        ).all()
    )
    concepts = list(session.scalars(select(ContentConcept).order_by(ContentConcept.position)))
    statements = session.scalars(select(ContentStatement).order_by(ContentStatement.position)).all()
    subjects = session.scalars(select(ContentSubject).order_by(ContentSubject.position)).all()
    lessons = list(session.scalars(select(ContentLesson).order_by(ContentLesson.position)))
    needed = _lesson_images(concepts, lessons) | {s.image for s in subjects}
    images = session.scalars(
        select(ContentImage).where(ContentImage.name.in_(needed)).order_by(ContentImage.name)
    ).all()
    return {
        "version": version,
        "locale": locale,
        "rtl": locale in RTL_LOCALES,
        "subjects": [{"id": s.id, "status": s.status, "image": s.image} for s in subjects],
        "lessons": [_lesson(lesson) for lesson in lessons],
        "concepts": [
            {"id": c.id, "category": c.category, "image": c.image, "word": words[c.id]} for c in concepts
        ],
        "statements": [
            {"id": s.id, "set": s.set_name, "safe": s.safe, "text": texts[s.id]} for s in statements
        ],
        "images": {image.name: image.svg for image in images},
        "audio": audio,
    }


def _lesson_images(concepts: list[ContentConcept], lessons: list[ContentLesson]) -> set[str]:
    used: set[str] = set()
    for lesson in lessons:
        if lesson.kind == "vocabulary":
            used.update(lesson.items)
        if lesson.math and lesson.math.get("object"):
            used.add(lesson.math["object"])
    return {concept.image for concept in concepts if concept.id in used}


def _lesson(lesson: ContentLesson) -> dict:
    data = {
        "id": lesson.id,
        "subject": lesson.subject_id,
        "level": lesson.level,
        "kind": lesson.kind,
        "items": lesson.items,
    }
    if lesson.math:
        data["math"] = lesson.math
    return data

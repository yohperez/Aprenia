from collections.abc import Iterable
from xml.sax.saxutils import escape

import httpx
from sqlalchemy.orm import Session

from yara_api.content_store import ContentBundle, spoken_texts, text_digest
from yara_api.models import ContentAudio

VOICES = {
    "es": "es-ES-ElviraNeural",
    "en": "en-US-JennyNeural",
    "fr": "fr-FR-DeniseNeural",
    "pt": "pt-BR-FranciscaNeural",
    "ar": "ar-SA-ZariyahNeural",
    "fa": "fa-IR-DilaraNeural",
    "ps": "ps-AF-LatifaNeural",
    "ur": "ur-PK-UzmaNeural",
}
OUTPUT_FORMAT = "audio-16khz-32kbitrate-mono-mp3"
MIME = "audio/mpeg"


class SpeechError(RuntimeError):
    pass


class AzureSpeech:
    def __init__(self, key: str, region: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=20)
        self._url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
        self._headers = {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
            "User-Agent": "yara-api",
        }

    def synthesize(self, text: str, locale: str) -> bytes:
        voice = VOICES[locale]
        language = "-".join(voice.split("-")[:2])
        ssml = (
            f"<speak version='1.0' xml:lang='{language}'><voice name='{voice}'>"
            f"<prosody rate='-10%'>{escape(text)}</prosody></voice></speak>"
        )
        response = self._client.post(self._url, headers=self._headers, content=ssml.encode())
        if response.status_code != 200 or not response.content:
            raise SpeechError(f"Speech service answered {response.status_code}")
        return response.content


def generate_audio(
    db: Session, bundle: ContentBundle, speech: AzureSpeech, locales: Iterable[str], only_missing: bool = True
) -> int:
    created = 0
    for locale in locales:
        for item_id, text in spoken_texts(bundle, locale).items():
            digest = text_digest(text)
            existing = db.get(ContentAudio, (locale, item_id))
            if only_missing and existing and existing.digest == digest:
                continue
            data = speech.synthesize(text, locale)
            if existing:
                existing.data, existing.digest = data, digest
            else:
                db.add(ContentAudio(locale=locale, item_id=item_id, mime=MIME, digest=digest, data=data))
            created += 1
        db.commit()
    return created

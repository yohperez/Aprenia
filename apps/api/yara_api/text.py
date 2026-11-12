import re
import unicodedata

WORD = re.compile(r"\w+", re.UNICODE)
ARABIC_SCRIPT = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")
LATIN_SCRIPT = re.compile(r"[A-Za-zÀ-ɏ]")
SENTENCE_END = re.compile(r"[.!?؟۔।]+")


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return unicodedata.normalize("NFKC", stripped).replace("‌", " ")


def tokens(text: str) -> list[str]:
    return WORD.findall(fold(text))


def contains_phrase(text: str, phrase: str) -> bool:
    pattern = r"(?<!\w)" + re.escape(fold(phrase)) + r"(?!\w)"
    return re.search(pattern, fold(text)) is not None


def sentence_count(text: str) -> int:
    return len([part for part in SENTENCE_END.split(text) if part.strip()])


def script_share(text: str, rtl: bool) -> float:
    arabic = len(ARABIC_SCRIPT.findall(text))
    latin = len(LATIN_SCRIPT.findall(text))
    total = arabic + latin
    if total == 0:
        return 1.0
    return (arabic if rtl else latin) / total

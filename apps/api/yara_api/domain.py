from typing import Literal, get_args

Locale = Literal["es", "en", "fr", "pt", "ar", "fa", "ps", "ur"]
AgeBand = Literal[
    "5-9",
    "10-14",
    "15-19",
    "20-24",
    "25-29",
    "30-34",
    "35-39",
    "40-44",
    "45-49",
    "50-54",
    "55-59",
    "60-64",
    "65-69",
    "70-74",
    "75-79",
    "80+",
]
Audience = Literal["child", "teen", "adult"]
LearningMode = Literal["early", "junior", "teen", "adult", "senior"]
Goal = Literal["learn_new", "learn_tech", "free_training", "resume_studies"]
Placement = Literal["test", "zero"]
TutorIntent = Literal["explain", "example", "slower"]
TutorStatus = Literal[
    "ok",
    "off_topic",
    "blocked",
    "escalated",
    "limit",
    "unavailable",
    "disabled",
    "not_allowed",
]

LOCALES: tuple[str, ...] = get_args(Locale)
AGE_BANDS: tuple[str, ...] = get_args(AgeBand)
RTL_LOCALES = frozenset({"ar", "fa", "ps", "ur"})
LOCALE_NAMES = {
    "es": "Spanish",
    "en": "English",
    "fr": "French",
    "pt": "Portuguese",
    "ar": "Arabic",
    "fa": "Persian",
    "ps": "Pashto",
    "ur": "Urdu",
}
RECOVERY_WORD_COUNT = 6
RECOVERY_WORDLIST_SIZE = 256
MAX_LEVEL = 3
AUDIENCE_DESCRIPTIONS = {"child": "a child", "teen": "a teenager", "adult": "an adult"}


def band_start(age_band: str) -> int:
    return int(age_band.split("-")[0].rstrip("+"))


def audience_of(age_band: str) -> Audience:
    start = band_start(age_band)
    if start < 15:
        return "child"
    if start < 20:
        return "teen"
    return "adult"


def mode_of(age_band: str) -> LearningMode:
    start = band_start(age_band)
    if start < 10:
        return "early"
    if start < 15:
        return "junior"
    if start < 20:
        return "teen"
    if start < 60:
        return "adult"
    return "senior"


def allows_free_text(age_band: str) -> bool:
    return audience_of(age_band) != "child"

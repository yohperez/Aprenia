import json
import re
from dataclasses import dataclass

from yara_api.domain import RTL_LOCALES, mode_of
from yara_api.text import contains_phrase, script_share, sentence_count
from yara_api.tutor.context import LessonContext
from yara_api.tutor.prompts import SAFETY_TOKEN, SENTENCE_LIMITS
from yara_api.tutor.redaction import has_contact_data
from yara_api.tutor.screening import screen_text

CHARACTER_LIMITS = {"early": 240, "junior": 340, "teen": 480, "adult": 520, "senior": 420}
MIN_SCRIPT_SHARE = 0.6
JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)


@dataclass(frozen=True)
class OutputCheck:
    status: str
    answer: str | None = None
    reason: str | None = None


def parse_reply(raw: str) -> tuple[str, bool] | None:
    match = JSON_OBJECT.search(raw)
    if match is None:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    answer, on_topic = data.get("answer"), data.get("on_topic")
    if not isinstance(answer, str) or not isinstance(on_topic, bool):
        return None
    return answer.strip(), on_topic


def check_output(raw: str, context: LessonContext, age_band: str, locale: str) -> OutputCheck:
    parsed = parse_reply(raw)
    if parsed is None:
        return OutputCheck("blocked", reason="invalid_format")
    answer, on_topic = parsed
    if answer == SAFETY_TOKEN:
        return OutputCheck("escalated", reason="model_escalation")
    if not on_topic:
        return OutputCheck("off_topic", reason="model_off_topic")
    failure = _first_failure(answer, context, age_band, locale)
    if failure:
        return OutputCheck("blocked", reason=failure)
    return OutputCheck("ok", answer=answer)


def _first_failure(answer: str, context: LessonContext, age_band: str, locale: str) -> str | None:
    if not answer:
        return "empty"
    mode = mode_of(age_band)
    if len(answer) > CHARACTER_LIMITS[mode] or sentence_count(answer) > SENTENCE_LIMITS[mode] + 1:
        return "too_long"
    if has_contact_data(answer):
        return "contact_data"
    if screen_text(answer):
        return "unsafe_output"
    if script_share(answer, locale in RTL_LOCALES) < MIN_SCRIPT_SHARE:
        return "wrong_language"
    if context.must_mention and not contains_phrase(answer, context.must_mention):
        return "not_grounded"
    return None

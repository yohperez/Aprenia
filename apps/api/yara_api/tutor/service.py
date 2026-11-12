from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import Session

from yara_api.config import Settings
from yara_api.domain import allows_free_text
from yara_api.models import Account, TutorEvent, TutorUsage
from yara_api.schemas import TutorRequest
from yara_api.tutor.context import LessonContext, build_context
from yara_api.tutor.output import check_output
from yara_api.tutor.policies import Policy, PolicyIndex
from yara_api.tutor.prompts import build_prompt
from yara_api.tutor.providers import ProviderError, TutorProvider
from yara_api.tutor.redaction import redact
from yara_api.tutor.screening import is_injection, is_on_topic, screen_text


class UnknownLessonItem(LookupError):
    pass


@dataclass(frozen=True)
class TutorOutcome:
    status: str
    answer: str | None = None
    reason: str | None = None
    policies: list[Policy] = field(default_factory=list)


@dataclass(frozen=True)
class TutorCall:
    account: Account
    request: TutorRequest
    now: datetime

    @property
    def mode(self) -> str:
        return "text" if self.request.question is not None else "preset"


class TutorService:
    def __init__(self, settings: Settings, provider: TutorProvider | None, policies: PolicyIndex) -> None:
        self.settings = settings
        self.provider = provider
        self.policies = policies

    def handle(self, db: Session, call: TutorCall) -> TutorOutcome:
        outcome = self._evaluate(db, call)
        db.add(
            TutorEvent(
                account_id=call.account.id,
                lesson_id=call.request.lesson_id,
                mode=call.mode,
                intent=call.request.intent,
                status=outcome.status,
                reason=outcome.reason,
                policy_ids=[p.id for p in outcome.policies],
                created_at=call.now,
            )
        )
        db.commit()
        return outcome

    def _evaluate(self, db: Session, call: TutorCall) -> TutorOutcome:
        request, age_band = call.request, call.account.age_band
        if not self.settings.tutor_enabled:
            return TutorOutcome("disabled", reason="kill_switch")
        if self.provider is None:
            return TutorOutcome("unavailable", reason="no_provider")
        if age_band is None or (call.mode == "text" and not allows_free_text(age_band)):
            return TutorOutcome("not_allowed", reason="age_band")
        context = build_context(db, request.lesson_id, request.item_id, request.locale)
        if context is None:
            raise UnknownLessonItem(request.item_id)
        question = None
        if request.question is not None:
            screened = self._screen_question(request.question, context)
            if isinstance(screened, TutorOutcome):
                return screened
            question = screened
        policies = self.policies.for_tutor(age_band, f"{context.facts} {question or request.intent}")
        if not self._consume_quota(db, call):
            return TutorOutcome("limit", reason="daily_limit", policies=policies)
        prompt = build_prompt(context, age_band, request.locale, policies, request.intent, question)
        try:
            raw = self.provider.complete(prompt)
        except ProviderError:
            return TutorOutcome("unavailable", reason="provider_error", policies=policies)
        check = check_output(raw, context, age_band, request.locale)
        return TutorOutcome(check.status, check.answer, check.reason, policies)

    def _screen_question(self, question: str, context: LessonContext) -> str | TutorOutcome:
        concern = screen_text(question)
        if concern == "harm":
            return TutorOutcome("escalated", reason="harm_signal")
        if concern:
            return TutorOutcome("blocked", reason=f"{concern}_content")
        if is_injection(question):
            return TutorOutcome("blocked", reason="prompt_injection")
        redacted, _ = redact(question)
        if not is_on_topic(redacted, context.terms):
            return TutorOutcome("off_topic", reason="lexical_scope")
        return redacted

    def _consume_quota(self, db: Session, call: TutorCall) -> bool:
        limit = (
            self.settings.tutor_text_daily_limit
            if call.mode == "text"
            else self.settings.tutor_preset_daily_limit
        )
        key = (call.account.id, call.now.date(), call.mode)
        usage = db.get(TutorUsage, key)
        if usage is None:
            usage = TutorUsage(account_id=key[0], day=key[1], mode=key[2], count=0)
            db.add(usage)
        if usage.count >= limit:
            return False
        usage.count += 1
        db.flush()
        return True

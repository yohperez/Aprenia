from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from yara_api.domain import (
    MAX_LEVEL,
    RECOVERY_WORD_COUNT,
    RECOVERY_WORDLIST_SIZE,
    AgeBand,
    Goal,
    Locale,
    Placement,
    TutorIntent,
    TutorStatus,
)

RecoveryWord = Annotated[int, Field(ge=0, lt=RECOVERY_WORDLIST_SIZE)]
Identifier = Annotated[str, StringConstraints(pattern=r"^[a-z0-9_-]{1,40}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GuestRequest(StrictModel):
    locale: Locale


class RecoverRequest(StrictModel):
    words: Annotated[
        list[RecoveryWord], Field(min_length=RECOVERY_WORD_COUNT, max_length=RECOVERY_WORD_COUNT)
    ]


class Profile(StrictModel):
    locale: Locale
    age_band: AgeBand | None
    goal: Goal | None


class ProfileUpdate(StrictModel):
    locale: Locale | None = None
    age_band: AgeBand | None = None
    goal: Goal | None = None


class SessionResponse(StrictModel):
    account_id: str
    token: str
    profile: Profile


class GuestResponse(SessionResponse):
    recovery_words: list[int]


class SubjectProgressItem(StrictModel):
    subject_id: Identifier
    level: Annotated[int, Field(ge=1, le=MAX_LEVEL)]
    placement: Placement
    updated_at: datetime


class LessonProgressItem(StrictModel):
    lesson_id: Identifier
    completed: bool
    best_score: Annotated[int, Field(ge=0, le=100)]
    attempts: Annotated[int, Field(ge=0, le=10000)]
    updated_at: datetime


class ProgressUpdate(StrictModel):
    subjects: Annotated[list[SubjectProgressItem], Field(max_length=16)] = []
    lessons: Annotated[list[LessonProgressItem], Field(max_length=200)] = []


class ProgressSnapshot(StrictModel):
    profile: Profile
    subjects: list[SubjectProgressItem]
    lessons: list[LessonProgressItem]


class TutorRequest(StrictModel):
    locale: Locale
    lesson_id: Identifier
    item_id: Identifier
    intent: TutorIntent | None = None
    question: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)] | None
    ) = None

    @model_validator(mode="after")
    def exactly_one_request(self) -> "TutorRequest":
        if (self.intent is None) == (self.question is None):
            raise ValueError("Send either an intent or a question")
        return self


class PolicyReference(StrictModel):
    id: str
    title: str


class TutorResponse(StrictModel):
    status: TutorStatus
    answer: str | None = None
    policies: list[PolicyReference] = []


class PolicyResult(StrictModel):
    id: str
    title: str
    source: str
    url: str
    rule: str
    text: str

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status

from yara_api.deps import CurrentAccount, DbSession, Now
from yara_api.domain import AgeBand
from yara_api.schemas import PolicyReference, PolicyResult, TutorRequest, TutorResponse
from yara_api.tutor.service import TutorCall, UnknownLessonItem

router = APIRouter(prefix="/v1", tags=["tutor"])


@router.post("/tutor")
def ask_tutor(
    body: TutorRequest, request: Request, account: CurrentAccount, db: DbSession, now: Now
) -> TutorResponse:
    try:
        outcome = request.app.state.tutor.handle(db, TutorCall(account=account, request=body, now=now))
    except UnknownLessonItem as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown lesson item") from error
    return TutorResponse(
        status=outcome.status,
        answer=outcome.answer,
        policies=[PolicyReference(id=p.id, title=p.title) for p in outcome.policies],
    )


@router.get("/policies")
def search_policies(
    request: Request,
    q: Annotated[str, Query(max_length=200)] = "",
    age_band: AgeBand | None = None,
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> list[PolicyResult]:
    index = request.app.state.policies
    found = index.search(q, age_band, limit) if q.strip() else index.policies[:limit]
    return [
        PolicyResult(id=p.id, title=p.title, source=p.source, url=p.url, rule=p.rule, text=p.text)
        for p in found
    ]

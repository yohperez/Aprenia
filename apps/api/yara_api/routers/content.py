from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Path, Request, Response, status

from yara_api.deps import DbSession
from yara_api.domain import Locale
from yara_api.models import ContentAudio, ContentImage
from yara_api.schemas import Identifier

ImageName = Annotated[str, Path(pattern=r"^[0-9a-f]{2,6}(-[0-9a-f]{2,6}){0,3}$")]

router = APIRouter(prefix="/v1", tags=["content"])
PACK_CACHE = "public, max-age=3600, stale-while-revalidate=604800"
IMMUTABLE_CACHE = "public, max-age=31536000, immutable"


@router.get("/packs/{locale}")
def read_pack(
    locale: Locale,
    request: Request,
    db: DbSession,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    pack = request.app.state.packs.get(db, locale)
    if pack is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Content is not loaded")
    headers = {"ETag": pack.etag, "Cache-Control": PACK_CACHE}
    if if_none_match == pack.etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return Response(content=pack.body, media_type="application/json", headers=headers)


@router.get("/audio/{locale}/{item_id}")
def read_audio(locale: Locale, item_id: Identifier, db: DbSession) -> Response:
    audio = db.get(ContentAudio, (locale, item_id))
    if audio is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No audio")
    return Response(
        content=audio.data,
        media_type=audio.mime,
        headers={"Cache-Control": IMMUTABLE_CACHE, "ETag": f'"{audio.digest}"'},
    )


@router.get("/images/{name}.svg")
def read_image(name: ImageName, db: DbSession) -> Response:
    image = db.get(ContentImage, name)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No image")
    return Response(
        content=image.svg,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": IMMUTABLE_CACHE,
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        },
    )

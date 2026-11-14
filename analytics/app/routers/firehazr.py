from fastapi import APIRouter, HTTPException

from app.schemas.firehazr import FireHazRRequest
from app.services import firehazr

router = APIRouter(tags=["FireHazR"])


def unavailable(error):
    raise HTTPException(status_code=503, detail="FireHazR artifacts are unavailable or inconsistent.") from error


@router.get("/firehazr")
def metadata():
    try:
        return firehazr.metadata()
    except (OSError, ValueError, KeyError) as error:
        unavailable(error)


@router.post("/firehazr/predict")
def predict(body: FireHazRRequest):
    try:
        return firehazr.predict(body)
    except (OSError, ValueError, KeyError) as error:
        unavailable(error)

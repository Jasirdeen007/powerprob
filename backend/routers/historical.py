from fastapi import APIRouter, Query

from services.firebase import query_historical

router = APIRouter(tags=["historical"])


@router.get("/historical")
def get_historical(
    session_id: str = Query(...),
    start: str | None = Query(default=None, alias="from"),
    end: str | None = Query(default=None, alias="to"),
):
    return {
        "session_id": session_id,
        "packets": query_historical(session_id, start, end),
    }

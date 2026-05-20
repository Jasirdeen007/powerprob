from fastapi import APIRouter

from models.session import SessionEndRequest, SessionStartRequest
from services.sessions import end_session, list_all_sessions, start_session

router = APIRouter(tags=["sessions"])


@router.post("/session/start")
async def create_session(request: SessionStartRequest):
    return await start_session(request)


@router.post("/session/end")
async def complete_session(request: SessionEndRequest):
    return await end_session(request)


@router.get("/sessions")
def get_sessions():
    return {"sessions": list_all_sessions()}

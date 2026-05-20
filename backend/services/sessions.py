from datetime import UTC, datetime
import logging

from models.command import CommandPayload
from models.session import SessionEndRequest, SessionStartRequest
from services import firebase
from services.profile_commands import build_profile_command
from services.websocket_manager import pi_ws_manager

logger = logging.getLogger(__name__)
local_sessions: dict[str, dict] = {}


def make_session_id(request: SessionStartRequest) -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    battery_id = request.battery_id.strip().upper()
    return f"SESSION_{stamp}_{battery_id}"


async def start_session(request: SessionStartRequest) -> dict:
    session_id = make_session_id(request)
    record = {
        "session_id": session_id,
        "battery_id": request.battery_id.strip().upper(),
        "config": request.config.model_dump(),
        "status": "running",
        "started_at": datetime.now(UTC).isoformat(),
        "ended_at": None,
    }
    local_sessions[session_id] = record
    firebase.save_session(session_id, record)

    profile_command = build_profile_command(request.config.drone_type)
    pi_ws_manager.set_active_session(session_id, profile_command["profile_name"])
    command = CommandPayload(session_id=session_id, command=profile_command).model_dump()
    command_sent = await pi_ws_manager.send_command(command)
    logger.info("Started session %s for battery %s command_sent=%s", session_id, record["battery_id"], command_sent)
    return {
        "session_id": session_id,
        "status": "started",
        "command_sent": command_sent,
        "command": command,
    }


async def end_session(request: SessionEndRequest) -> dict:
    ended_at = datetime.now(UTC).isoformat()
    fields = {"status": "completed", "ended_at": ended_at}
    local_sessions.setdefault(request.session_id, {"session_id": request.session_id}).update(fields)
    firebase.update_session(request.session_id, fields)
    await pi_ws_manager.send_command(
        CommandPayload(
            type="STOP_PROFILE",
            session_id=request.session_id,
            command={"reason": "session_end"},
        ).model_dump()
    )
    pi_ws_manager.clear_active_session(request.session_id)
    logger.info("Ended session %s", request.session_id)
    return {"session_id": request.session_id, "status": "completed"}


def list_all_sessions() -> list[dict]:
    firebase_sessions = firebase.list_sessions()
    if firebase_sessions:
        return firebase_sessions
    return list(local_sessions.values())

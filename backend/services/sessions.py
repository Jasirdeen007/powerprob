from datetime import UTC, datetime
import logging

from fastapi import HTTPException

from models.command import CommandPayload
from models.session import SessionEndRequest, SessionStartRequest
from services import firebase
from services.mqtt_service import DeviceBusyError, mqtt_service
from services.profile_commands import build_profile_command
from services.websocket_manager import pi_ws_manager

logger = logging.getLogger(__name__)
local_sessions: dict[str, dict] = {}
session_users: dict[str, str] = {}


def make_session_id(request: SessionStartRequest) -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    battery_id = request.battery_id.strip().upper()
    return f"SESSION_{stamp}_{battery_id}"


async def start_session(request: SessionStartRequest) -> dict:
    session_id = make_session_id(request)
    profile_command = build_profile_command(request.config.drone_type)
    try:
        device_id = mqtt_service.reserve_device_for_session(session_id, request.device_id)
    except DeviceBusyError as error:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "The Raspberry Pi is already running another session.",
                "device_id": error.device_id,
                "active_session_id": error.active_session_id,
            },
        ) from error
    record = {
        "session_id": session_id,
        "user_id": request.user_id,
        "battery_id": request.battery_id.strip().upper(),
        "battery_name": request.battery_name.strip() if request.battery_name else "",
        "device_id": device_id,
        "config": request.config.model_dump(),
        "status": "running",
        "started_at": datetime.now(UTC).isoformat(),
        "ended_at": None,
    }
    local_sessions[session_id] = record
    session_users[session_id] = request.user_id
    firebase.save_session(session_id, record, request.user_id)

    pi_ws_manager.set_active_session(session_id, profile_command["profile_name"])
    command = CommandPayload(session_id=session_id, command=profile_command).model_dump()
    command_sent = mqtt_service.publish_command(session_id, command, device_id=device_id)
    if not command_sent:
        command_sent = await pi_ws_manager.send_command(command)
    if not command_sent:
        mqtt_service.clear_active_session(session_id)
        local_sessions.pop(session_id, None)
        session_users.pop(session_id, None)
        firebase.update_session(
            session_id,
            {
                "status": "failed",
                "ended_at": datetime.now(UTC).isoformat(),
                "failure_reason": "No Raspberry Pi MQTT/WebSocket command channel was available.",
            },
            request.user_id,
        )
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Could not send START_PROFILE to the Raspberry Pi.",
                "device_id": device_id,
                "hint": "Check /pi/status, Pi MQTT service logs, and access to broker.emqx.io:1883.",
            },
        )
    logger.info(
        "Started session %s for battery %s device=%s command_sent=%s",
        session_id,
        record["battery_id"],
        device_id,
        command_sent,
    )
    return {
        "session_id": session_id,
        "status": "started",
        "command_sent": command_sent,
        "command": command,
        "device_id": device_id,
    }


async def end_session(request: SessionEndRequest) -> dict:
    ended_at = datetime.now(UTC).isoformat()
    device_id = mqtt_service.session_devices.get(request.session_id)
    stop_command = CommandPayload(
        type="STOP_PROFILE",
        session_id=request.session_id,
        device_id=device_id,
        command={"reason": "session_end"},
    ).model_dump(exclude_none=True)
    command_sent = mqtt_service.publish_command(request.session_id, stop_command, device_id=device_id)
    if not command_sent:
        command_sent = await pi_ws_manager.send_command(stop_command)
    if not command_sent:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Could not send STOP_PROFILE to the Raspberry Pi.",
                "device_id": device_id,
                "hint": "Session was left running so you can retry Stop after MQTT reconnects.",
            },
        )

    fields = {"status": "completed", "ended_at": ended_at}
    local_sessions.setdefault(request.session_id, {"session_id": request.session_id}).update(fields)
    session_users[request.session_id] = request.user_id
    firebase.update_session(request.session_id, fields, request.user_id)
    moved_packets = firebase.finalize_session_telemetry(request.session_id, request.user_id)
    firebase.update_session(
        request.session_id,
        {
            "telemetry_packet_count": moved_packets,
            "status": "completed",
            "ended_at": ended_at,
        },
        request.user_id,
    )
    pi_ws_manager.clear_active_session(request.session_id)
    mqtt_service.clear_active_session(request.session_id)
    session_users.pop(request.session_id, None)
    logger.info("Ended session %s", request.session_id)
    return {
        "session_id": request.session_id,
        "status": "completed",
        "telemetry_packet_count": moved_packets,
        "command_sent": command_sent,
        "device_id": device_id,
    }


def list_all_sessions(user_id: str) -> list[dict]:
    firebase_sessions = firebase.list_sessions(user_id)
    if firebase_sessions:
        return firebase_sessions
    return [session for session in local_sessions.values() if session.get("user_id") == user_id]


def get_session_capacity_ah(session_id: str) -> float | None:
    config = local_sessions.get(session_id, {}).get("config", {})
    capacity = config.get("capacity_ah")
    try:
        return float(capacity)
    except (TypeError, ValueError):
        return None


def get_session_user_id(session_id: str) -> str | None:
    return session_users.get(session_id) or local_sessions.get(session_id, {}).get("user_id")

from datetime import UTC, datetime
import json
import logging
from pathlib import Path

from fastapi import HTTPException

from models.command import CommandPayload
from models.session import SessionEndRequest, SessionStartRequest
from services import firebase
from services.mqtt_service import DeviceBusyError, mqtt_service
from services.profile_commands import build_profile_command

logger = logging.getLogger(__name__)
local_sessions: dict[str, dict] = {}
session_users: dict[str, str] = {}
SESSION_REGISTRY_PATH = Path(__file__).resolve().parents[1] / "data" / "session_registry.json"


def load_session_registry() -> dict[str, dict]:
    try:
        if not SESSION_REGISTRY_PATH.exists():
            return {}
        data = json.loads(SESSION_REGISTRY_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception as error:
        logger.warning("Failed to load local session registry: %s", error)
        return {}


def save_session_registry(registry: dict[str, dict]) -> None:
    try:
        SESSION_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
        SESSION_REGISTRY_PATH.write_text(json.dumps(registry, indent=2, sort_keys=True), encoding="utf-8")
    except Exception as error:
        logger.warning("Failed to save local session registry: %s", error)


def remember_session_owner(session_id: str, user_id: str, session: dict | None = None) -> None:
    if not session_id or not user_id:
        return
    session_users[session_id] = user_id
    if session:
        local_sessions.setdefault(session_id, {"session_id": session_id}).update(session)

    registry = load_session_registry()
    registry[session_id] = {
        "user_id": user_id,
        "session": local_sessions.get(session_id) or session or {"session_id": session_id, "user_id": user_id},
    }
    save_session_registry(registry)


def cleanup_stale_sessions() -> int:
    count = 0
    for session_id, session in list(local_sessions.items()):
        if session.get("status") != "running":
            continue
        device_id = session.get("device_id") or mqtt_service.session_devices.get(session_id)
        if device_id and mqtt_service.active_session_for_device(device_id):
            continue
        session["status"] = "interrupted"
        session["ended_at"] = datetime.now(UTC).isoformat()
        uid = session.get("user_id", "")
        remember_session_owner(session_id, uid, session)
        firebase.update_session(session_id, {
            "status": "interrupted",
            "ended_at": session["ended_at"],
        }, uid)
        mqtt_service.clear_active_session(session_id)
        logger.info("Cleaned up stale session %s (device %s unreachable)", session_id, device_id)
        count += 1
    return count


def make_session_id(request: SessionStartRequest) -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    battery_id = request.battery_id.strip().upper()
    return f"SESSION_{stamp}_{battery_id}"


def build_device_start_command(session_id: str, user_id: str, profile_command: dict) -> dict:
    return CommandPayload(
        session_id=session_id,
        command={
            "profile_id": profile_command.get("profile_id"),
            "profile_name": profile_command.get("profile_name", "ESP32_PROFILE"),
            "source_file": profile_command.get("source_file"),
            "sample_count": profile_command.get("sample_count"),
            "user_id": user_id,
        },
    ).model_dump(exclude_none=True)


async def start_session(request: SessionStartRequest) -> dict:
    session_id = make_session_id(request)
    profile_command = build_profile_command(request.config.drone_type)
    try:
        device_id = mqtt_service.reserve_device_for_session(session_id, request.device_id)
    except DeviceBusyError as error:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "The Pi is already running another session.",
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
    remember_session_owner(session_id, request.user_id, record)
    firebase.save_session(session_id, record, request.user_id)

    command = CommandPayload(session_id=session_id, command=profile_command).model_dump()
    device_command = build_device_start_command(session_id, request.user_id, profile_command)
    command_sent = mqtt_service.publish_command(session_id, device_command, device_id=device_id)
    if not command_sent:
        mqtt_service.clear_active_session(session_id)
        local_sessions.pop(session_id, None)
        session_users.pop(session_id, None)
        firebase.update_session(
            session_id,
            {
                "status": "failed",
                "ended_at": datetime.now(UTC).isoformat(),
                "failure_reason": "No ESP32 MQTT command channel was available.",
            },
            request.user_id,
        )
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Could not send START_PROFILE to the Pi.",
                "device_id": device_id,
                "hint": "Check /esp32/status, Pi service logs, and access to broker.emqx.io:1883.",
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
    existing = local_sessions.get(request.session_id, {})
    if existing.get("status") in ("completed", "interrupted"):
        return {
            "session_id": request.session_id,
            "status": existing.get("status", "completed"),
            "telemetry_packet_count": 0,
            "command_sent": False,
            "device_id": None,
        }

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
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Could not send STOP_PROFILE to the Pi.",
                "device_id": device_id,
                "hint": "Session was left running so you can retry Stop after the MQTT connection is restored.",
            },
        )

    fields = {"status": "completed", "ended_at": ended_at}
    local_sessions.setdefault(request.session_id, {"session_id": request.session_id}).update(fields)
    remember_session_owner(request.session_id, request.user_id, local_sessions.get(request.session_id))
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
    cleanup_stale_sessions()
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
    user_id = session_users.get(session_id) or local_sessions.get(session_id, {}).get("user_id")
    if user_id:
        return user_id

    owner = firebase.find_session_owner(session_id)
    recovered_user_id = owner.get("user_id") if owner else None
    if recovered_user_id:
        remember_session_owner(session_id, recovered_user_id, owner.get("session") or {})
        return recovered_user_id

    registry_entry = load_session_registry().get(session_id)
    if isinstance(registry_entry, dict):
        recovered_user_id = registry_entry.get("user_id")
        if recovered_user_id:
            remember_session_owner(session_id, recovered_user_id, registry_entry.get("session") or {})
    return recovered_user_id

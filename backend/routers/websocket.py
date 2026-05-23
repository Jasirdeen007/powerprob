from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import json

from models.command import CommandPayload
from models.telemetry import TelemetryPacket, WebSocketMessage
from services import firebase
from services.metrics import enrich_packet
from services.websocket_manager import pi_ws_manager

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)


async def process_telemetry(payload: dict):
    payload = normalize_telemetry_payload(payload)
    packet = TelemetryPacket.model_validate(payload)
    enriched = enrich_packet(packet)
    data = enriched.model_dump(mode="json")
    firebase.write_latest_telemetry(packet.session_id, data)
    firebase.append_telemetry(packet.session_id, data)
    logger.info("Telemetry accepted session=%s event=%s", packet.session_id, packet.event)
    return data


def parse_json_maybe_string(value):
    while isinstance(value, str):
        value = json.loads(value)
    return value


def normalize_telemetry_payload(payload: dict) -> dict:
    payload = parse_json_maybe_string(payload)
    if not isinstance(payload, dict):
        raise ValueError("Telemetry payload must be a JSON object")

    if "session_id" not in payload and pi_ws_manager.active_session_id:
        payload["session_id"] = pi_ws_manager.active_session_id
    if "profile" not in payload:
        payload["profile"] = pi_ws_manager.active_profile or "UNKNOWN"
    return payload


def normalize_ws_message(raw):
    message = parse_json_maybe_string(raw)
    if not isinstance(message, dict):
        raise ValueError("WebSocket message must be a JSON object")

    if "type" in message:
        if isinstance(message.get("payload"), str):
            message["payload"] = parse_json_maybe_string(message["payload"])
        return message

    if "timestamp" in message and "pack_voltage" in message:
        return {"type": "telemetry", "payload": message}

    return {"type": "status", "payload": message}


@router.post("/telemetry")
async def receive_telemetry(packet: TelemetryPacket):
    data = await process_telemetry(packet.model_dump(mode="json"))
    return {"status": "accepted", "packet": data}


@router.post("/pi/command")
async def send_pi_command(command: CommandPayload):
    payload = command.model_dump()
    sent = await pi_ws_manager.send_command(payload)
    return {"sent": sent, "command": payload}


@router.get("/pi/status")
async def get_pi_status():
    return pi_ws_manager.status()


@router.websocket("/ws/pi")
async def pi_websocket(websocket: WebSocket):
    await pi_ws_manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            message = WebSocketMessage.model_validate(normalize_ws_message(raw))
            if message.type == "telemetry":
                data = await process_telemetry(message.payload)
                await websocket.send_json({"type": "telemetry_ack", "payload": data})
            else:
                await websocket.send_json({"type": "ack", "payload": {"received": message.type}})
    except WebSocketDisconnect:
        pi_ws_manager.disconnect(websocket)

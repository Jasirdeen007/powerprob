from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

from models.command import CommandPayload
from models.telemetry import TelemetryPacket, WebSocketMessage
from services.mqtt_service import mqtt_service
from services.telemetry import parse_json_maybe_string, process_telemetry
from services.websocket_manager import pi_ws_manager

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)


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
    data = process_telemetry(packet.model_dump(mode="json"))
    return {"status": "accepted", "packet": data}


@router.post("/pi/command")
async def send_pi_command(command: CommandPayload):
    payload = command.model_dump()
    sent = mqtt_service.publish_command(command.session_id, payload)
    if not sent:
        sent = await pi_ws_manager.send_command(payload)
    return {"sent": sent, "command": payload}


@router.get("/pi/status")
async def get_pi_status():
    status = mqtt_service.status()
    if not status["connected"]:
        websocket_status = pi_ws_manager.status()
        if websocket_status.get("connected"):
            return websocket_status
    return status


@router.websocket("/ws/pi")
async def pi_websocket(websocket: WebSocket):
    await pi_ws_manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            message = WebSocketMessage.model_validate(normalize_ws_message(raw))
            if message.type == "telemetry":
                data = process_telemetry(message.payload, device_id="websocket-pi")
                await websocket.send_json({"type": "telemetry_ack", "payload": data})
            else:
                await websocket.send_json({"type": "ack", "payload": {"received": message.type}})
    except WebSocketDisconnect:
        pi_ws_manager.disconnect(websocket)

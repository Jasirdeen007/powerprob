from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

from models.telemetry import TelemetryPacket, WebSocketMessage
from services import firebase
from services.metrics import enrich_packet
from services.websocket_manager import pi_ws_manager

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)


async def process_telemetry(payload: dict):
    packet = TelemetryPacket.model_validate(payload)
    enriched = enrich_packet(packet)
    data = enriched.model_dump(mode="json")
    firebase.write_latest_telemetry(packet.session_id, data)
    firebase.append_telemetry(packet.session_id, data)
    logger.info("Telemetry accepted session=%s event=%s", packet.session_id, packet.event)
    return data


@router.post("/telemetry")
async def receive_telemetry(packet: TelemetryPacket):
    data = await process_telemetry(packet.model_dump(mode="json"))
    return {"status": "accepted", "packet": data}


@router.websocket("/ws/pi")
async def pi_websocket(websocket: WebSocket):
    await pi_ws_manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_json()
            message = WebSocketMessage.model_validate(raw)
            if message.type == "telemetry":
                data = await process_telemetry(message.payload)
                await websocket.send_json({"type": "telemetry_ack", "payload": data})
            else:
                await websocket.send_json({"type": "ack", "payload": {"received": message.type}})
    except WebSocketDisconnect:
        pi_ws_manager.disconnect(websocket)

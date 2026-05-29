from __future__ import annotations

import json
import logging

from models.telemetry import TelemetryPacket
from services import firebase
from services.metrics import enrich_packet

logger = logging.getLogger(__name__)


def parse_json_maybe_string(value):
    while isinstance(value, str):
        value = json.loads(value)
    return value


def normalize_telemetry_payload(payload: dict) -> dict:
    payload = parse_json_maybe_string(payload)
    if not isinstance(payload, dict):
        raise ValueError("Telemetry payload must be a JSON object")
    return payload


def process_telemetry(payload: dict, device_id: str | None = None) -> dict:
    packet = TelemetryPacket.model_validate(normalize_telemetry_payload(payload))
    from services.sessions import get_session_user_id

    user_id = packet.user_id or get_session_user_id(packet.session_id)
    if not user_id:
        logger.warning("Telemetry ignored for unknown user session=%s device=%s", packet.session_id, device_id)
        raise ValueError(f"No user mapping found for telemetry session {packet.session_id}")

    enriched = enrich_packet(packet)
    data = enriched.model_dump(mode="json")
    data["user_id"] = user_id
    if device_id:
        data["device_id"] = device_id

    firebase.write_latest_telemetry(packet.session_id, data, user_id)
    firebase.append_live_telemetry(packet.session_id, data, user_id)
    logger.info(
        "Telemetry accepted session=%s battery=%s device=%s event=%s",
        packet.session_id,
        packet.battery_id,
        device_id,
        packet.event,
    )
    return data

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
    enriched = enrich_packet(packet)
    data = enriched.model_dump(mode="json")
    if device_id:
        data["device_id"] = device_id

    firebase.write_latest_telemetry(packet.session_id, data)
    firebase.append_live_telemetry(packet.session_id, data)
    logger.info(
        "Telemetry accepted session=%s battery=%s device=%s event=%s",
        packet.session_id,
        packet.battery_id,
        device_id,
        packet.event,
    )
    return data

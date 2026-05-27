from __future__ import annotations

from pathlib import Path
from typing import Any
import logging

import firebase_admin
from firebase_admin import credentials, db, firestore

from services.config import settings

logger = logging.getLogger(__name__)
local_telemetry: dict[str, list[dict[str, Any]]] = {}


def firebase_available() -> bool:
    return bool(settings.firebase_service_account_path and settings.firebase_database_url)


def get_firebase_app():
    if not firebase_available():
        return None

    if firebase_admin._apps:
        return firebase_admin.get_app()

    service_account_path = Path(settings.firebase_service_account_path)
    if not service_account_path.exists():
        return None

    cred = credentials.Certificate(str(service_account_path))
    return firebase_admin.initialize_app(
        cred,
        {"databaseURL": settings.firebase_database_url},
    )


def get_firestore_client():
    app = get_firebase_app()
    return firestore.client(app=app) if app else None


def write_latest_telemetry(session_id: str, packet: dict[str, Any]) -> bool:
    try:
        app = get_firebase_app()
        if not app:
            return False

        db.reference(f"telemetry/{session_id}/latest", app=app).set(packet)
        return True
    except Exception as error:
        logger.warning("Failed to write latest telemetry to Firebase: %s", error)
        return False


def append_live_telemetry(session_id: str, packet: dict[str, Any]) -> bool:
    local_telemetry.setdefault(session_id, []).append(packet)
    try:
        app = get_firebase_app()
        if not app:
            return False

        packet_id = packet["timestamp"].replace(":", "-").replace(".", "-")
        db.reference(f"telemetry/{session_id}/packets/{packet_id}", app=app).set(packet)
        return True
    except Exception as error:
        logger.warning("Failed to append live telemetry to Firebase RTDB: %s", error)
        return False


def append_telemetry(session_id: str, packet: dict[str, Any]) -> bool:
    return append_live_telemetry(session_id, packet)


def finalize_session_telemetry(session_id: str) -> int:
    packets = local_telemetry.get(session_id, [])
    try:
        app = get_firebase_app()
        client = get_firestore_client()
        if app:
            snapshot = db.reference(f"telemetry/{session_id}/packets", app=app).get() or {}
            if isinstance(snapshot, dict):
                packets = list(snapshot.values())

        if client:
            for packet in packets:
                packet_id = str(packet.get("timestamp", "")).replace(":", "-").replace(".", "-")
                if not packet_id:
                    continue
                client.collection("sessions").document(session_id).collection("telemetry").document(packet_id).set(packet)

        if app:
            db.reference(f"telemetry/{session_id}", app=app).delete()

        return len(packets)
    except Exception as error:
        logger.warning("Failed to finalize telemetry for session %s: %s", session_id, error)
        return 0


def save_session(session_id: str, session: dict[str, Any]) -> bool:
    try:
        client = get_firestore_client()
        if not client:
            return False

        client.collection("sessions").document(session_id).set(session, merge=True)
        return True
    except Exception as error:
        logger.warning("Failed to save session to Firestore: %s", error)
        return False


def update_session(session_id: str, fields: dict[str, Any]) -> bool:
    try:
        client = get_firestore_client()
        if not client:
            return False

        client.collection("sessions").document(session_id).set(fields, merge=True)
        return True
    except Exception as error:
        logger.warning("Failed to update session in Firestore: %s", error)
        return False


def list_sessions() -> list[dict[str, Any]]:
    try:
        client = get_firestore_client()
        if not client:
            return []

        docs = client.collection("sessions").order_by("started_at", direction=firestore.Query.DESCENDING).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as error:
        logger.warning("Failed to list sessions from Firestore: %s", error)
        return []


def query_historical(session_id: str, start: str | None, end: str | None) -> list[dict[str, Any]]:
    def within_range(packet: dict[str, Any]) -> bool:
        timestamp = packet.get("timestamp")
        if not timestamp:
            return False
        if start and timestamp < start:
            return False
        if end and timestamp > end:
            return False
        return True

    try:
        client = get_firestore_client()
        if not client:
            return sorted(
                [packet for packet in local_telemetry.get(session_id, []) if within_range(packet)],
                key=lambda packet: packet.get("timestamp", ""),
            )

        query = client.collection("sessions").document(session_id).collection("telemetry")
        if start:
            query = query.where("timestamp", ">=", start)
        if end:
            query = query.where("timestamp", "<=", end)
        packets = [doc.to_dict() for doc in query.order_by("timestamp").stream()]
        return packets or sorted(
            [packet for packet in local_telemetry.get(session_id, []) if within_range(packet)],
            key=lambda packet: packet.get("timestamp", ""),
        )
    except Exception as error:
        logger.warning("Failed to query historical telemetry from Firestore: %s", error)
        return sorted(
            [packet for packet in local_telemetry.get(session_id, []) if within_range(packet)],
            key=lambda packet: packet.get("timestamp", ""),
        )

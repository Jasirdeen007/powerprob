from __future__ import annotations

from pathlib import Path
from typing import Any
import logging

import firebase_admin
from firebase_admin import credentials, db, firestore

from services.config import settings

logger = logging.getLogger(__name__)
local_telemetry: dict[str, list[dict[str, Any]]] = {}
local_latest_telemetry: dict[str, dict[str, Any]] = {}
firebase_diagnostics: dict[str, Any] = {
    "last_rtdb_latest_ok": None,
    "last_rtdb_packets_ok": None,
    "last_firestore_finalize_count": None,
    "last_error": "",
}


def user_session_document(client, user_id: str, session_id: str):
    return client.collection("users").document(user_id).collection("sessions").document(session_id)


def live_telemetry_path(user_id: str, session_id: str) -> str:
    return f"users/{user_id}/telemetry/{session_id}"


def firebase_available() -> bool:
    return bool(settings.firebase_service_account_path and settings.firebase_database_url)


def get_firebase_app():
    if not firebase_available():
        return None

    if firebase_admin._apps:
        return firebase_admin.get_app()

    service_account_path = Path(settings.firebase_service_account_path)
    if not service_account_path.is_absolute():
        service_account_path = Path(__file__).resolve().parents[1] / service_account_path
    if not service_account_path.exists():
        firebase_diagnostics["last_error"] = f"Firebase service account file not found: {service_account_path}"
        return None

    cred = credentials.Certificate(str(service_account_path))
    return firebase_admin.initialize_app(
        cred,
        {"databaseURL": settings.firebase_database_url},
    )


def get_firestore_client():
    app = get_firebase_app()
    return firestore.client(app=app) if app else None


def write_latest_telemetry(session_id: str, packet: dict[str, Any], user_id: str) -> bool:
    local_latest_telemetry[session_id] = packet
    try:
        app = get_firebase_app()
        if not app:
            return False

        db.reference(f"{live_telemetry_path(user_id, session_id)}/latest", app=app).set(packet)
        firebase_diagnostics["last_rtdb_latest_ok"] = True
        firebase_diagnostics["last_error"] = ""
        return True
    except Exception as error:
        firebase_diagnostics["last_rtdb_latest_ok"] = False
        firebase_diagnostics["last_error"] = str(error)
        logger.warning("Failed to write latest telemetry to Firebase: %s", error)
        return False


def append_live_telemetry(session_id: str, packet: dict[str, Any], user_id: str) -> bool:
    local_telemetry.setdefault(session_id, []).append(packet)
    try:
        app = get_firebase_app()
        if not app:
            return False

        packet_id = packet["timestamp"].replace(":", "-").replace(".", "-")
        db.reference(f"{live_telemetry_path(user_id, session_id)}/packets/{packet_id}", app=app).set(packet)
        firebase_diagnostics["last_rtdb_packets_ok"] = True
        firebase_diagnostics["last_error"] = ""
        return True
    except Exception as error:
        firebase_diagnostics["last_rtdb_packets_ok"] = False
        firebase_diagnostics["last_error"] = str(error)
        logger.warning("Failed to append live telemetry to Firebase RTDB: %s", error)
        return False


def append_telemetry(session_id: str, packet: dict[str, Any], user_id: str) -> bool:
    return append_live_telemetry(session_id, packet, user_id)


def finalize_session_telemetry(session_id: str, user_id: str) -> int:
    packets = local_telemetry.get(session_id, [])
    try:
        app = get_firebase_app()
        client = get_firestore_client()
        if app:
            snapshot = db.reference(f"{live_telemetry_path(user_id, session_id)}/packets", app=app).get() or {}
            if isinstance(snapshot, dict):
                packets = list(snapshot.values())

        if client:
            for packet in packets:
                packet_id = str(packet.get("timestamp", "")).replace(":", "-").replace(".", "-")
                if not packet_id:
                    continue
                user_session_document(client, user_id, session_id).collection("telemetry").document(packet_id).set(packet)

        if app:
            db.reference(live_telemetry_path(user_id, session_id), app=app).delete()
        local_latest_telemetry.pop(session_id, None)
        firebase_diagnostics["last_firestore_finalize_count"] = len(packets)
        firebase_diagnostics["last_error"] = ""

        return len(packets)
    except Exception as error:
        firebase_diagnostics["last_firestore_finalize_count"] = 0
        firebase_diagnostics["last_error"] = str(error)
        logger.warning("Failed to finalize telemetry for session %s: %s", session_id, error)
        return 0


def list_live_telemetry(user_id: str | None = None) -> dict[str, Any]:
    return {
        session_id: {
            "latest": packet,
            "packets": {
                str(packet.get("timestamp", index)).replace(":", "-").replace(".", "-"): packet
                for index, packet in enumerate(local_telemetry.get(session_id, []))
            },
        }
        for session_id, packet in local_latest_telemetry.items()
        if user_id is None or packet.get("user_id") == user_id
    }


def get_diagnostics() -> dict[str, Any]:
    return {
        "firebase_configured": firebase_available(),
        "service_account_path": settings.firebase_service_account_path,
        "database_url": settings.firebase_database_url,
        "local_live_sessions": list(local_latest_telemetry.keys()),
        **firebase_diagnostics,
    }


def save_session(session_id: str, session: dict[str, Any], user_id: str) -> bool:
    try:
        client = get_firestore_client()
        if not client:
            return False

        user_session_document(client, user_id, session_id).set(session, merge=True)
        return True
    except Exception as error:
        logger.warning("Failed to save session to Firestore: %s", error)
        return False


def update_session(session_id: str, fields: dict[str, Any], user_id: str) -> bool:
    try:
        client = get_firestore_client()
        if not client:
            return False

        user_session_document(client, user_id, session_id).set(fields, merge=True)
        return True
    except Exception as error:
        logger.warning("Failed to update session in Firestore: %s", error)
        return False


def list_sessions(user_id: str) -> list[dict[str, Any]]:
    try:
        client = get_firestore_client()
        if not client:
            return []

        docs = client.collection("users").document(user_id).collection("sessions").order_by("started_at", direction=firestore.Query.DESCENDING).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as error:
        logger.warning("Failed to list sessions from Firestore: %s", error)
        return []


def find_session_owner(session_id: str) -> dict[str, Any] | None:
    try:
        client = get_firestore_client()
        if not client:
            return None

        docs = (
            client.collection_group("sessions")
            .where("session_id", "==", session_id)
            .limit(1)
            .stream()
        )
        for doc in docs:
            data = doc.to_dict() or {}
            user_id = data.get("user_id") or doc.reference.parent.parent.id
            return {"user_id": user_id, "session": data}
        return None
    except Exception as error:
        logger.warning("Failed to find session owner from Firestore: %s", error)
        return None


def query_historical(session_id: str, start: str | None, end: str | None, user_id: str) -> list[dict[str, Any]]:
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

        query = user_session_document(client, user_id, session_id).collection("telemetry")
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

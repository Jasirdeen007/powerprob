from services import firebase
from services.mqtt_service import mqtt_service
from services.sessions import local_sessions, session_users


def test_mqtt_telemetry_uses_user_from_device_status():
    session_id = "SESSION_STATUS_OWNER_TEAM6_PACK_1"
    user_id = "status-user"
    device_id = "esp32-001"

    mqtt_service.devices.clear()
    mqtt_service.session_devices.clear()
    mqtt_service.device_sessions.clear()
    mqtt_service.unknown_sessions_stopped.clear()
    session_users.pop(session_id, None)
    local_sessions.pop(session_id, None)
    firebase.local_telemetry.pop(session_id, None)
    firebase.local_latest_telemetry.pop(session_id, None)

    mqtt_service.record_status(
        device_id,
        {
            "device_id": device_id,
            "state": "running",
            "active_session_id": session_id,
            "user_id": user_id,
        },
    )

    packet = mqtt_service.record_telemetry(
        device_id,
        {
            "session_id": session_id,
            "battery_id": "TEAM6_PACK_1",
            "timestamp": "2026-06-25T12:45:53Z",
            "mode": "DISCHARGE",
            "pack_voltage": 11.8,
            "current": 1.2,
            "temperature": {"battery": 34.2, "mosfet": 46.8, "ambient": 29.1},
        },
    )

    assert packet["user_id"] == user_id
    assert packet["device_id"] == device_id
    assert firebase.local_latest_telemetry[session_id]["user_id"] == user_id

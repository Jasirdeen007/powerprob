from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from services.config import settings
from services.telemetry import process_telemetry

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None

logger = logging.getLogger(__name__)


class DeviceBusyError(ValueError):
    def __init__(self, device_id: str, active_session_id: str) -> None:
        self.device_id = device_id
        self.active_session_id = active_session_id
        super().__init__(f"Device {device_id} is already running session {active_session_id}")


@dataclass
class DeviceState:
    device_id: str
    last_seen: float = field(default_factory=time.time)
    last_telemetry: float | None = None
    status: dict[str, Any] = field(default_factory=dict)


class MqttService:
    def __init__(self) -> None:
        self.client = None
        self.connected = False
        self.devices: dict[str, DeviceState] = {}
        self.session_devices: dict[str, str] = {}
        self.device_sessions: dict[str, str] = {}

    def start(self) -> None:
        if mqtt is None:
            logger.warning("paho-mqtt is not installed; MQTT bridge is disabled")
            return
        if self.client:
            return

        self.client = mqtt.Client(client_id=settings.mqtt_client_id)
        if settings.mqtt_username:
            self.client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.client.connect_async(settings.mqtt_host, settings.mqtt_port, keepalive=30)
        self.client.loop_start()
        logger.info("MQTT bridge connecting to %s:%s", settings.mqtt_host, settings.mqtt_port)

    def stop(self) -> None:
        if not self.client:
            return
        self.client.loop_stop()
        self.client.disconnect()
        self.client = None
        self.connected = False

    def _on_connect(self, client, userdata, flags, rc) -> None:
        self.connected = rc == 0
        if not self.connected:
            logger.warning("MQTT connect failed rc=%s", rc)
            return
        client.subscribe("powerprobe/+/telemetry")
        client.subscribe("powerprobe/+/status")
        logger.info("MQTT bridge connected and subscribed to telemetry/status topics")

    def _on_disconnect(self, client, userdata, rc) -> None:
        self.connected = False
        logger.warning("MQTT bridge disconnected rc=%s", rc)

    def _on_message(self, client, userdata, message) -> None:
        try:
            parts = message.topic.split("/")
            if len(parts) != 3 or parts[0] != "powerprobe":
                return
            device_id, kind = parts[1], parts[2]
            payload = json.loads(message.payload.decode("utf-8") or "{}")
            if kind == "status":
                self.record_status(device_id, payload)
            elif kind == "telemetry":
                self.record_telemetry(device_id, payload)
        except Exception as error:
            logger.warning("Failed to process MQTT message topic=%s: %s", message.topic, error)

    def record_status(self, device_id: str, payload: dict[str, Any]) -> None:
        state = self.devices.setdefault(device_id, DeviceState(device_id=device_id))
        state.last_seen = time.time()
        state.status = payload if isinstance(payload, dict) else {"payload": payload}

    def record_telemetry(self, device_id: str, payload: dict[str, Any]) -> dict:
        state = self.devices.setdefault(device_id, DeviceState(device_id=device_id))
        state.last_seen = time.time()
        state.last_telemetry = state.last_seen
        data = process_telemetry(payload, device_id=device_id)
        session_id = data.get("session_id")
        if session_id:
            self.session_devices[str(session_id)] = device_id
            self.device_sessions[device_id] = str(session_id)
        return data

    def reserve_device_for_session(self, session_id: str, device_id: str | None = None) -> str:
        resolved = device_id or self.find_available_device_id()
        active_session_id = self.active_session_for_device(resolved)
        if active_session_id and active_session_id != session_id:
            raise DeviceBusyError(resolved, active_session_id)

        self.session_devices[session_id] = resolved
        self.device_sessions[resolved] = session_id
        return resolved

    def set_active_session(self, session_id: str, device_id: str | None = None) -> str:
        return self.reserve_device_for_session(session_id, device_id)

    def clear_active_session(self, session_id: str) -> None:
        device_id = self.session_devices.pop(session_id, None)
        if device_id and self.device_sessions.get(device_id) == session_id:
            self.device_sessions.pop(device_id, None)

    def active_session_for_device(self, device_id: str) -> str | None:
        local_session_id = self.device_sessions.get(device_id)
        if local_session_id:
            return local_session_id

        state = self.devices.get(device_id)
        if not state or not self._is_fresh(state.last_seen):
            return None

        reported_session_id = state.status.get("active_session_id")
        reported_state = str(state.status.get("state", "")).lower()
        if reported_session_id and reported_state != "idle":
            return str(reported_session_id)
        return None

    def find_available_device_id(self) -> str:
        fresh_devices = [
            state.device_id
            for state in self.devices.values()
            if self._is_fresh(state.last_seen)
        ]
        return sorted(fresh_devices)[0] if fresh_devices else settings.mqtt_default_device_id

    def publish_command(self, session_id: str, command: dict[str, Any], device_id: str | None = None) -> bool:
        if not self.client or not self.connected:
            return False
        resolved_device_id = device_id or self.session_devices.get(session_id) or self.find_available_device_id()
        topic = f"powerprobe/{resolved_device_id}/command"
        result = self.client.publish(topic, json.dumps(command), qos=1)
        return result.rc == mqtt.MQTT_ERR_SUCCESS

    def status(self) -> dict[str, Any]:
        now = time.time()
        devices = {
            device_id: {
                "device_id": state.device_id,
                "available": self._is_fresh(state.last_seen, now),
                "busy": bool(self.active_session_for_device(device_id)),
                "active_session_id": self.active_session_for_device(device_id),
                "last_seen": state.last_seen,
                "last_telemetry": state.last_telemetry,
                "status": state.status,
            }
            for device_id, state in self.devices.items()
        }
        fresh_telemetry = any(
            state.last_telemetry and self._is_fresh(state.last_telemetry, now)
            for state in self.devices.values()
        )
        available = any(device["available"] for device in devices.values())
        return {
            "connected": available,
            "mqtt_connected": self.connected,
            "telemetry_active": fresh_telemetry,
            "transport": "mqtt",
            "broker": f"{settings.mqtt_host}:{settings.mqtt_port}",
            "devices": devices,
            "active_sessions": self.session_devices,
            "device_sessions": self.device_sessions,
        }

    def _is_fresh(self, timestamp: float | None, now: float | None = None) -> bool:
        if timestamp is None:
            return False
        return (now or time.time()) - timestamp <= settings.mqtt_heartbeat_stale_seconds


mqtt_service = MqttService()

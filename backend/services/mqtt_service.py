from __future__ import annotations

import json
import logging
import socket
import time
import uuid
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
        self.unknown_sessions_stopped: set[tuple[str, str]] = set()
        self.broker_host = settings.mqtt_host
        self.topic_prefix = settings.mqtt_topic_prefix

    def start(self) -> None:
        if mqtt is None:
            logger.warning("paho-mqtt is not installed; MQTT bridge is disabled")
            return
        if self.client:
            return

        client_id = f"ppbe-{uuid.uuid4().hex[:12]}"
        self.client = mqtt.Client(
            client_id=client_id,
            clean_session=True,
            protocol=mqtt.MQTTv311,
        )
        self.client.reconnect_delay_set(min_delay=5, max_delay=60)
        if settings.mqtt_username:
            self.client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.broker_host = self._resolve_broker_host(settings.mqtt_host)
        self.client.connect_async(self.broker_host, settings.mqtt_port, keepalive=30)
        self.client.loop_start()
        logger.info(
            "MQTT bridge connecting to %s:%s configured_host=%s",
            self.broker_host,
            settings.mqtt_port,
            settings.mqtt_host,
        )

    def stop(self) -> None:
        if not self.client:
            return
        self.client.loop_stop()
        self.client.disconnect()
        self.client = None
        self.connected = False

    def _on_connect(self, client, userdata, flags, rc) -> None:
        rc_value = int(rc)
        self.connected = rc_value == 0
        if not self.connected:
            logger.warning(
                "MQTT connect failed rc=%s meaning=%s host=%s port=%s client_id_prefix=%s username_configured=%s",
                rc,
                self._connect_return_code_name(rc_value),
                self.broker_host,
                settings.mqtt_port,
                client._client_id.decode("utf-8", errors="replace"),
                bool(settings.mqtt_username),
            )
            return
        client.subscribe(f"{self.topic_prefix}/{settings.mqtt_default_device_id}/telemetry")
        client.subscribe(f"{self.topic_prefix}/{settings.mqtt_default_device_id}/status")
        logger.info(
            "MQTT bridge connected and subscribed to %s/%s",
            self.topic_prefix,
            settings.mqtt_default_device_id,
        )

    def _on_disconnect(self, client, userdata, rc) -> None:
        self.connected = False
        logger.warning("MQTT bridge disconnected rc=%s", rc)

    def _on_message(self, client, userdata, message) -> None:
        try:
            parsed = self._parse_topic(message.topic)
            if not parsed:
                return
            device_id, kind = parsed
            raw = message.payload.decode("utf-8") or ""
            if kind == "telemetry":
                payload = self._parse_telemetry_payload(raw, device_id)
                if payload is None:
                    return
                self.record_telemetry(device_id, payload)
            else:
                payload = json.loads(raw or "{}")
                self.record_status(device_id, payload)
        except Exception as error:
            logger.warning("Failed to process MQTT message topic=%s: %s", message.topic, error)

    def _parse_telemetry_payload(self, raw: str, device_id: str) -> dict[str, Any] | None:
        raw = raw.strip()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            pass
        return self._parse_csv_telemetry(raw, device_id)

    def _parse_csv_telemetry(self, raw: str, device_id: str) -> dict[str, Any] | None:
        """Parse Pi CSV telemetry: timestamp,current,pack_voltage,mosfet_temp,battery_temp"""
        parts = [p.strip() for p in raw.split(",")]
        if len(parts) < 5:
            logger.debug("Ignoring short CSV line from %s: %s", device_id, raw)
            return None
        try:
            timestamp_str = parts[0]
            current_a = float(parts[1])
            pack_voltage = float(parts[2])
            mosfet_temp = float(parts[3])
            battery_temp = float(parts[4])
        except (ValueError, IndexError):
            logger.debug("Ignoring unparseable CSV from %s: %s", device_id, raw)
            return None
        state = self.devices.get(device_id)
        session_id = str((state.status.get("active_session_id") or "") if state else "")
        user_id = str((state.status.get("user_id") or "") if state else "")
        if not session_id:
            logger.debug("No active session for device=%s, ignoring CSV telemetry", device_id)
            return None
        return {
            "session_id": session_id,
            "user_id": user_id or None,
            "timestamp": timestamp_str,
            "mode": "DISCHARGE",
            "pack_voltage": pack_voltage,
            "current": current_a,
            "temperature": {
                "battery": battery_temp,
                "mosfet": mosfet_temp,
                "ambient": 25.0,
            },
            "event": "",
        }

    def record_status(self, device_id: str, payload: dict[str, Any]) -> None:
        state = self.devices.setdefault(device_id, DeviceState(device_id=device_id))
        state.last_seen = time.time()
        state.status = payload if isinstance(payload, dict) else {"payload": payload}
        session_id = str(state.status.get("active_session_id") or "")
        user_id = str(state.status.get("user_id") or "")
        if session_id and user_id and str(state.status.get("state", "")).lower() != "idle":
            from services.sessions import remember_session_owner

            self.session_devices[session_id] = device_id
            self.device_sessions[device_id] = session_id
            remember_session_owner(session_id, user_id)
        elif str(state.status.get("state", "")).lower() == "idle" and not session_id:
            stale_session_id = self.device_sessions.pop(device_id, None)
            if stale_session_id and self.session_devices.get(stale_session_id) == device_id:
                self.session_devices.pop(stale_session_id, None)
                logger.info(
                    "Cleared stale session mapping for device=%s session=%s (device reports idle)",
                    device_id,
                    stale_session_id,
                )

    def record_telemetry(self, device_id: str, payload: dict[str, Any]) -> dict:
        state = self.devices.setdefault(device_id, DeviceState(device_id=device_id))
        state.last_seen = time.time()
        state.last_telemetry = state.last_seen
        payload = self._enrich_payload_from_device_state(device_id, payload)
        incoming_session_id = str(payload.get("session_id") or "")
        if incoming_session_id and (device_id, incoming_session_id) in self.unknown_sessions_stopped:
            logger.debug(
                "Ignoring telemetry for already-stopped unknown session=%s device=%s",
                incoming_session_id,
                device_id,
            )
            return {
                "session_id": incoming_session_id,
                "device_id": device_id,
                "ignored": True,
                "reason": "unknown_session",
            }

        try:
            data = process_telemetry(payload, device_id=device_id)
        except ValueError as error:
            if "No user mapping found for telemetry session" not in str(error):
                raise
            return self.stop_unknown_session(device_id, payload, error)

        session_id = data.get("session_id")
        if session_id:
            self.session_devices[str(session_id)] = device_id
            self.device_sessions[device_id] = str(session_id)
        return data

    def _enrich_payload_from_device_state(self, device_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return payload

        enriched = dict(payload)
        state = self.devices.get(device_id)
        status = state.status if state else {}
        status_session_id = str(status.get("active_session_id") or "")
        status_user_id = str(status.get("user_id") or "")

        if not enriched.get("session_id") and status_session_id:
            enriched["session_id"] = status_session_id
        if not enriched.get("user_id") and status_user_id:
            enriched["user_id"] = status_user_id

        return enriched

    def stop_unknown_session(
        self,
        device_id: str,
        payload: dict[str, Any],
        error: Exception | None = None,
    ) -> dict[str, Any]:
        session_id = str(payload.get("session_id") or "")
        if not session_id:
            raise error or ValueError("No user mapping found for telemetry without a session id")

        key = (device_id, session_id)
        if key in self.unknown_sessions_stopped:
            logger.debug("Ignoring repeated telemetry for stopped unknown session=%s device=%s", session_id, device_id)
            return {
                "session_id": session_id,
                "device_id": device_id,
                "ignored": True,
                "reason": "unknown_session",
            }

        self.unknown_sessions_stopped.add(key)
        logger.warning(
            "Telemetry received for unknown session=%s device=%s; sending STOP_PROFILE so the ESP32 can return to idle",
            session_id,
            device_id,
        )

        if not self.client or not self.connected:
            return {
                "session_id": session_id,
                "device_id": device_id,
                "ignored": True,
                "reason": "unknown_session_mqtt_disconnected",
            }

        topic = f"{self.topic_prefix}/{device_id}/command"
        command = {
            "type": "STOP_PROFILE",
            "session_id": session_id,
            "device_id": device_id,
            "command": {"reason": "unknown_session_after_backend_restart"},
        }
        self.client.publish(topic, json.dumps(command), qos=1)
        self.clear_active_session(str(session_id))
        return {
            "session_id": session_id,
            "device_id": device_id,
            "ignored": True,
            "reason": "unknown_session_stop_sent",
        }

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
        self.unknown_sessions_stopped = {
            key for key in self.unknown_sessions_stopped if key[1] != session_id
        }

    def active_session_for_device(self, device_id: str) -> str | None:
        local_session_id = self.device_sessions.get(device_id)
        state = self.devices.get(device_id)
        if not state:
            return local_session_id
        if not self._is_fresh(state.last_seen):
            return None
        if local_session_id:
            return local_session_id

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
        topic = f"{self.topic_prefix}/{resolved_device_id}/command"
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
        active_session_devices = {
            session_id: device_id
            for session_id, device_id in self.session_devices.items()
            if self.active_session_for_device(device_id) == session_id
        }
        active_device_sessions = {
            device_id: session_id
            for device_id, session_id in self.device_sessions.items()
            if self.active_session_for_device(device_id) == session_id
        }
        fresh_telemetry = any(
            state.last_telemetry
            and self._is_fresh(state.last_telemetry, now)
            and str(state.status.get("state", "")).lower() == "running"
            for state in self.devices.values()
        )
        available = any(device["available"] for device in devices.values())
        return {
            "connected": available,
            "mqtt_connected": self.connected,
            "telemetry_active": fresh_telemetry,
            "transport": "mqtt",
            "broker": f"{settings.mqtt_host}:{settings.mqtt_port}",
            "broker_resolved": f"{self.broker_host}:{settings.mqtt_port}",
            "topic_prefix": self.topic_prefix,
            "devices": devices,
            "active_sessions": active_session_devices,
            "device_sessions": active_device_sessions,
        }

    def _resolve_broker_host(self, host: str) -> str:
        if not settings.mqtt_prefer_ipv4:
            return host
        try:
            infos = socket.getaddrinfo(host, settings.mqtt_port, socket.AF_INET, socket.SOCK_STREAM)
        except OSError as error:
            logger.warning("Could not resolve MQTT host %s to IPv4: %s", host, error)
            return host

        for info in infos:
            address = info[4][0]
            if address:
                return address
        return host

    def _parse_topic(self, topic: str) -> tuple[str, str] | None:
        prefix_parts = self.topic_prefix.split("/")
        parts = topic.split("/")
        if len(parts) != len(prefix_parts) + 2:
            return None
        if parts[: len(prefix_parts)] != prefix_parts:
            return None
        device_id, kind = parts[-2], parts[-1]
        if kind not in {"status", "telemetry"}:
            return None
        return device_id, kind

    def _is_fresh(self, timestamp: float | None, now: float | None = None) -> bool:
        if timestamp is None:
            return False
        return (now or time.time()) - timestamp <= settings.mqtt_heartbeat_stale_seconds

    def _connect_return_code_name(self, rc: int) -> str:
        return {
            0: "accepted",
            1: "unacceptable protocol version",
            2: "identifier rejected",
            3: "server unavailable",
            4: "bad username or password",
            5: "not authorized",
        }.get(rc, "unknown")


mqtt_service = MqttService()

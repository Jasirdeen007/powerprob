from __future__ import annotations

import argparse
import json
import os
import random
import signal
import time
from datetime import UTC, datetime
from pathlib import Path
from threading import Event, Thread
from typing import Any

import paho.mqtt.client as mqtt


DEFAULT_BROKER_HOST = os.getenv("POWERPROBE_MQTT_HOST", "127.0.0.1")
DEFAULT_BROKER_PORT = int(os.getenv("POWERPROBE_MQTT_PORT", "1883"))
DEFAULT_DEVICE_ID = os.getenv("POWERPROBE_DEVICE_ID", "pi-001")
DEFAULT_BATTERY_ID = os.getenv("POWERPROBE_BATTERY_ID", "B0047")
DEFAULT_BATTERY_NAME = os.getenv("POWERPROBE_BATTERY_NAME", "")
DEFAULT_STATE_FILE = os.getenv("POWERPROBE_STATE_FILE", "/home/pi/powerprobe/latest_profile.json")
TELEMETRY_INTERVAL_SECONDS = float(os.getenv("POWERPROBE_TELEMETRY_INTERVAL", "1"))
HEARTBEAT_INTERVAL_SECONDS = float(os.getenv("POWERPROBE_HEARTBEAT_INTERVAL", "10"))

active_profile_task: Thread | None = None
active_session_id: str | None = None
active_profile_name = "IDLE"
latest_vref_v = 0.0
paused = False
stop_requested = Event()


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def save_latest_profile(state_file: Path, session_id: str, command: dict[str, Any]) -> None:
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps({"session_id": session_id, "command": command}, indent=2),
        encoding="utf-8",
    )


def apply_output(vref_v: float) -> None:
    # TODO: Replace this with your real DAC/PWM/GPIO output code.
    # Example: set DAC output to vref_v, update PWM duty cycle, or switch load relay.
    print(f"Applying output vref_V={vref_v}")


def read_telemetry(session_id: str, battery_id: str, battery_name: str) -> dict[str, Any]:
    # TODO: Replace these fake values with real sensor reads.
    # If your hardware only measures temperature, remove pack_voltage,
    # cell_voltage, and current from this returned dict.
    cell1 = round(3.95 + random.uniform(-0.02, 0.02), 2)
    cell2 = round(3.94 + random.uniform(-0.02, 0.02), 2)
    cell3 = round(3.93 + random.uniform(-0.02, 0.02), 2)
    current = round(max(0.0, latest_vref_v * 2.5 + random.uniform(-0.2, 0.2)), 2)

    packet = {
        "session_id": session_id,
        "battery_id": battery_id,
        "timestamp": utc_now(),
        "mode": "DISCHARGE" if latest_vref_v > 0 else "IDLE",
        "pack_voltage": round(cell1 + cell2 + cell3, 2),
        "cell_voltage": {"cell1": cell1, "cell2": cell2, "cell3": cell3},
        "current": current,
        "temperature": {
            "battery": round(32 + random.uniform(-0.5, 0.5), 1),
            "mosfet": round(40 + current * 0.5 + random.uniform(-0.8, 0.8), 1),
            "ambient": 29.1,
        },
        "event": "",
    }
    if battery_name:
        packet["battery_name"] = battery_name
    return packet


def run_profile(command: dict[str, Any]) -> None:
    global latest_vref_v

    control_points = command.get("control_points", [])
    if not isinstance(control_points, list):
        print("START_PROFILE ignored: control_points is not a list")
        return

    previous_timestamp = 0.0
    for point in control_points:
        if stop_requested.is_set() or not active_session_id:
            break

        while paused and not stop_requested.is_set():
            if not active_session_id:
                break
            time.sleep(0.2)
        if not active_session_id:
            break

        try:
            timestamp_s = float(point["timestamp_s"])
            vref_v = float(point["vref_V"])
        except (KeyError, TypeError, ValueError):
            print(f"Skipping invalid control point: {point}")
            continue

        time.sleep(max(0.0, timestamp_s - previous_timestamp))
        latest_vref_v = vref_v
        apply_output(vref_v)
        previous_timestamp = timestamp_s

    latest_vref_v = 0.0
    apply_output(0.0)
    print("Profile complete")


def publish_json(client: mqtt.Client, topic: str, payload: dict[str, Any]) -> None:
    client.publish(topic, json.dumps(payload), qos=1)


def telemetry_loop(client: mqtt.Client, device_id: str, battery_id: str, battery_name: str) -> None:
    telemetry_topic = f"powerprobe/{device_id}/telemetry"
    status_topic = f"powerprobe/{device_id}/status"
    last_heartbeat = 0.0

    while not stop_requested.is_set():
        now = time.time()
        if now - last_heartbeat >= HEARTBEAT_INTERVAL_SECONDS:
            publish_json(
                client,
                status_topic,
                {
                    "device_id": device_id,
                    "timestamp": utc_now(),
                    "state": "running" if active_session_id and not paused else "idle",
                    "active_session_id": active_session_id,
                    "profile": active_profile_name,
                },
            )
            last_heartbeat = now

        if active_session_id and not paused:
            publish_json(client, telemetry_topic, read_telemetry(active_session_id, battery_id, battery_name))

        time.sleep(TELEMETRY_INTERVAL_SECONDS)


def handle_command(message: dict[str, Any], state_file: Path) -> None:
    global active_profile_name, active_profile_task, active_session_id, latest_vref_v, paused

    command_type = message.get("type")
    session_id = message.get("session_id")
    command = message.get("command", {})
    print(f"Command received type={command_type} session_id={session_id}")

    if command_type == "START_PROFILE" and session_id:
        active_session_id = session_id
        active_profile_name = str(command.get("profile_name", command.get("profile_id", "PROFILE")))
        paused = False
        save_latest_profile(state_file, session_id, command)

        if active_profile_task and active_profile_task.is_alive():
            active_session_id = None
            active_profile_task.join(timeout=2)
            active_session_id = session_id

        active_profile_task = Thread(target=run_profile, args=(command,), daemon=True)
        active_profile_task.start()
    elif command_type == "PAUSE_PROFILE":
        paused = True
        print("Profile paused")
    elif command_type == "RESUME_PROFILE":
        if active_session_id:
            paused = False
        print("Profile resumed")
    elif command_type == "STOP_PROFILE":
        paused = True
        active_session_id = None
        active_profile_name = "IDLE"
        latest_vref_v = 0.0
        apply_output(0.0)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PowerProbe Raspberry Pi MQTT client.")
    parser.add_argument("--host", default=DEFAULT_BROKER_HOST, help="MQTT broker host or IP")
    parser.add_argument("--port", type=int, default=DEFAULT_BROKER_PORT, help="MQTT broker port")
    parser.add_argument("--device-id", default=DEFAULT_DEVICE_ID, help="Device id used in MQTT topics")
    parser.add_argument("--battery-id", default=DEFAULT_BATTERY_ID, help="Default battery id for telemetry")
    parser.add_argument("--battery-name", default=DEFAULT_BATTERY_NAME, help="Optional battery name")
    parser.add_argument("--state-file", default=DEFAULT_STATE_FILE, help="Latest START_PROFILE command save path")
    parser.add_argument("--username", default=os.getenv("POWERPROBE_MQTT_USERNAME"))
    parser.add_argument("--password", default=os.getenv("POWERPROBE_MQTT_PASSWORD"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    state_file = Path(args.state_file)
    command_topic = f"powerprobe/{args.device_id}/command"

    client = mqtt.Client(client_id=f"powerprobe-{args.device_id}")
    if args.username:
        client.username_pw_set(args.username, args.password)

    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print(f"Connected to MQTT broker {args.host}:{args.port}")
            client.subscribe(command_topic, qos=1)
        else:
            print(f"MQTT connect failed rc={rc}")

    def on_message(client, userdata, message):
        try:
            handle_command(json.loads(message.payload.decode("utf-8")), state_file)
        except Exception as error:
            print(f"Ignoring invalid command: {error}")

    client.on_connect = on_connect
    client.on_message = on_message

    signal.signal(signal.SIGTERM, lambda signum, frame: stop_requested.set())
    signal.signal(signal.SIGINT, lambda signum, frame: stop_requested.set())

    client.connect(args.host, args.port, keepalive=30)
    client.loop_start()
    telemetry_thread = Thread(
        target=telemetry_loop,
        args=(client, args.device_id, args.battery_id, args.battery_name),
        daemon=True,
    )
    telemetry_thread.start()

    try:
        while not stop_requested.is_set():
            time.sleep(0.5)
    finally:
        client.loop_stop()
        client.disconnect()
        apply_output(0.0)


if __name__ == "__main__":
    main()

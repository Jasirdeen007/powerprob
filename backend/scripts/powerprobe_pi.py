from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
from datetime import datetime
from pathlib import Path
from typing import Any

import websockets


DEFAULT_SERVER_URL = os.getenv("POWERPROBE_WS_URL", "ws://127.0.0.1:8000/ws/pi")
DEFAULT_STATE_FILE = os.getenv("POWERPROBE_STATE_FILE", "/home/pi/powerprobe/latest_profile.json")
RECONNECT_DELAY_SECONDS = 3
TELEMETRY_INTERVAL_SECONDS = 1

active_profile_task: asyncio.Task | None = None
active_session_id: str | None = None
active_profile_name = "IDLE"
latest_vref_v = 0.0
paused = False


def save_latest_profile(state_file: Path, session_id: str, command: dict[str, Any]) -> None:
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps({"session_id": session_id, "command": command}, indent=2),
        encoding="utf-8",
    )


async def apply_output(vref_v: float) -> None:
    # TODO: Replace this with your real DAC/PWM/GPIO output code.
    # Example: set DAC output to vref_v, update PWM duty cycle, or switch load relay.
    print(f"Applying output vref_V={vref_v}")


async def read_telemetry(session_id: str) -> dict[str, Any]:
    # TODO: Replace these fake values with ADC/BMS sensor reads from the Pi.
    cell1 = round(3.95 + random.uniform(-0.02, 0.02), 2)
    cell2 = round(3.94 + random.uniform(-0.02, 0.02), 2)
    cell3 = round(3.93 + random.uniform(-0.02, 0.02), 2)
    current = round(max(0.0, latest_vref_v * 2.5 + random.uniform(-0.2, 0.2)), 2)

    return {
        "session_id": session_id,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "mode": "DISCHARGE" if latest_vref_v > 0 else "IDLE",
        "profile": active_profile_name,
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


async def run_profile(command: dict[str, Any]) -> None:
    global latest_vref_v

    control_points = command.get("control_points", [])
    if not isinstance(control_points, list):
        print("START_PROFILE ignored: control_points is not a list")
        return

    previous_timestamp = 0.0
    for point in control_points:
        if not active_session_id:
            break

        while paused:
            if not active_session_id:
                break
            await asyncio.sleep(0.2)
        if not active_session_id:
            break

        try:
            timestamp_s = float(point["timestamp_s"])
            vref_v = float(point["vref_V"])
        except (KeyError, TypeError, ValueError):
            print(f"Skipping invalid control point: {point}")
            continue

        await asyncio.sleep(max(0.0, timestamp_s - previous_timestamp))
        latest_vref_v = vref_v
        await apply_output(vref_v)
        previous_timestamp = timestamp_s

    latest_vref_v = 0.0
    await apply_output(0.0)
    print("Profile complete")


async def telemetry_loop(websocket) -> None:
    while True:
        if active_session_id and not paused:
            packet = await read_telemetry(active_session_id)
            await websocket.send(json.dumps({"type": "telemetry", "payload": packet}))
        await asyncio.sleep(TELEMETRY_INTERVAL_SECONDS)


async def handle_server_message(websocket, raw: str, state_file: Path) -> None:
    global active_profile_name, active_profile_task, active_session_id, paused

    try:
        message = json.loads(raw)
    except json.JSONDecodeError:
        print(f"Ignoring non-JSON message: {raw}")
        return

    message_type = message.get("type")
    if message_type in {"ack", "telemetry_ack"}:
        print(f"Backend acknowledgement: {json.dumps(message.get('payload', {}))}")
        return

    session_id = message.get("session_id")
    command = message.get("command", {})
    print(f"Command received type={message_type} session_id={session_id}")

    if message_type == "START_PROFILE" and session_id:
        active_session_id = session_id
        active_profile_name = str(command.get("profile_name", command.get("profile_id", "PROFILE")))
        paused = False
        save_latest_profile(state_file, session_id, command)

        if active_profile_task and not active_profile_task.done():
            active_profile_task.cancel()
            try:
                await active_profile_task
            except asyncio.CancelledError:
                print("Previous profile stopped")

        active_profile_task = asyncio.create_task(run_profile(command))
    elif message_type == "PAUSE_PROFILE":
        paused = True
        print("Profile paused")
    elif message_type == "RESUME_PROFILE":
        if active_session_id:
            paused = False
        print("Profile resumed")
    elif message_type == "STOP_PROFILE":
        paused = True
        active_session_id = None
        active_profile_name = "IDLE"
        latest_vref_v = 0.0
        await apply_output(0.0)
        if active_profile_task and not active_profile_task.done():
            active_profile_task.cancel()
            try:
                await active_profile_task
            except asyncio.CancelledError:
                print("Profile stopped")

    await websocket.send(
        json.dumps(
            {
                "type": "ack",
                "payload": {"received": message_type, "session_id": session_id},
            }
        )
    )


async def connect_forever(server_url: str, state_file: Path) -> None:
    while True:
        telemetry_task: asyncio.Task | None = None
        try:
            async with websockets.connect(server_url, open_timeout=15, ping_interval=20, ping_timeout=20) as websocket:
                print(f"Connected to {server_url}")
                telemetry_task = asyncio.create_task(telemetry_loop(websocket))
                async for raw in websocket:
                    await handle_server_message(websocket, raw, state_file)
        except (OSError, TimeoutError, websockets.WebSocketException) as error:
            print(f"WebSocket disconnected: {error}. Reconnecting in {RECONNECT_DELAY_SECONDS} seconds...")
        finally:
            if telemetry_task:
                telemetry_task.cancel()
        await asyncio.sleep(RECONNECT_DELAY_SECONDS)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PowerProbe Raspberry Pi WebSocket client.")
    parser.add_argument(
        "server_url",
        nargs="?",
        default=DEFAULT_SERVER_URL,
        help="Backend websocket URL, for example ws://192.168.1.20:8000/ws/pi",
    )
    parser.add_argument(
        "--state-file",
        default=DEFAULT_STATE_FILE,
        help="Where the latest START_PROFILE command should be saved on the Pi",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    await connect_forever(args.server_url, Path(args.state_file))


if __name__ == "__main__":
    asyncio.run(main())

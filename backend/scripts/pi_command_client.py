from __future__ import annotations

import asyncio
import argparse
import json
import os
from pathlib import Path
from typing import Any

import websockets


DEFAULT_SERVER_URL = os.getenv("POWERPROBE_WS_URL", "ws://127.0.0.1:8000/ws/pi")
DEFAULT_STATE_FILE = os.getenv("POWERPROBE_STATE_FILE", "/home/pi/powerprobe/latest_profile.json")
RECONNECT_DELAY_SECONDS = 3


active_profile_task: asyncio.Task | None = None


def save_latest_profile(state_file: Path, session_id: str, command: dict[str, Any]) -> None:
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps(
            {
                "session_id": session_id,
                "command": command,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


async def apply_vref(vref_v: float) -> None:
    """Replace this function with real DAC/PWM/GPIO output code on the Pi."""
    print(f"Applying vref_V={vref_v}")


async def run_profile(command: dict[str, Any]) -> None:
    control_points = command.get("control_points", [])
    if not isinstance(control_points, list):
        print("START_PROFILE ignored: control_points is not a list")
        return

    previous_timestamp = 0.0
    for point in control_points:
        try:
            timestamp_s = float(point["timestamp_s"])
            vref_v = float(point["vref_V"])
        except (KeyError, TypeError, ValueError):
            print(f"Skipping invalid control point: {point}")
            continue

        await asyncio.sleep(max(0.0, timestamp_s - previous_timestamp))
        await apply_vref(vref_v)
        previous_timestamp = timestamp_s

    print("Profile complete")


async def handle_command(websocket, message: dict, state_file: Path):
    global active_profile_task

    command_type = message.get("type")
    if command_type in {"ack", "telemetry_ack"}:
        print(f"Backend acknowledgement: {json.dumps(message.get('payload', {}))}")
        return

    session_id = message.get("session_id")
    command = message.get("command", {})

    print(f"Command received type={command_type} session_id={session_id}")
    print(json.dumps(command, indent=2))

    if command_type == "START_PROFILE":
        save_latest_profile(state_file, session_id, command)
        if active_profile_task and not active_profile_task.done():
            active_profile_task.cancel()
            try:
                await active_profile_task
            except asyncio.CancelledError:
                print("Previous profile stopped")
        active_profile_task = asyncio.create_task(run_profile(command))

    await websocket.send(
        json.dumps(
            {
                "type": "ack",
                "payload": {
                    "received": command_type,
                    "session_id": session_id,
                },
            }
        )
    )


async def connect_forever(server_url: str, state_file: Path):
    while True:
        try:
            async with websockets.connect(server_url, open_timeout=15, ping_interval=20, ping_timeout=20) as websocket:
                print(f"Connected to {server_url}")
                async for raw in websocket:
                    try:
                        message = json.loads(raw)
                    except json.JSONDecodeError:
                        print(f"Ignoring non-JSON message: {raw}")
                        continue

                    await handle_command(websocket, message, state_file)
        except (OSError, TimeoutError, websockets.WebSocketException) as error:
            print(f"WebSocket disconnected: {error}. Reconnecting in {RECONNECT_DELAY_SECONDS} seconds...")
            await asyncio.sleep(RECONNECT_DELAY_SECONDS)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PowerProbe Raspberry Pi websocket command client.")
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


async def main():
    args = parse_args()
    await connect_forever(args.server_url, Path(args.state_file))


if __name__ == "__main__":
    asyncio.run(main())

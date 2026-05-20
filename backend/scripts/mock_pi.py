import asyncio
import json
import os
import random
import sys
from datetime import datetime

import websockets


SERVER_URL = sys.argv[1] if len(sys.argv) > 1 else os.getenv("POWERPROBE_WS_URL", "ws://127.0.0.1:8000/ws/pi")
active_session_id = None
active_profile = "IDLE"
paused = True


def make_packet(index: int) -> dict:
    cell1 = round(3.96 - index * 0.002 + random.uniform(-0.01, 0.01), 2)
    cell2 = round(3.95 - index * 0.002 + random.uniform(-0.01, 0.01), 2)
    cell3 = round(3.94 - index * 0.002 + random.uniform(-0.01, 0.01), 2)
    current = round(7.8 + random.uniform(-0.8, 1.4), 2)
    battery_temp = round(33 + index * 0.08 + random.uniform(-0.3, 0.5), 1)

    return {
        "session_id": active_session_id,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "mode": "DISCHARGE",
        "profile": active_profile,
        "pack_voltage": round(cell1 + cell2 + cell3, 2),
        "cell_voltage": {
            "cell1": cell1,
            "cell2": cell2,
            "cell3": cell3,
        },
        "current": current,
        "temperature": {
            "battery": battery_temp,
            "mosfet": round(44 + current * 0.4 + random.uniform(-1, 1), 1),
            "ambient": 29.1,
        },
        "event": "LOAD_SPIKE" if index % 12 == 0 else "",
    }


async def receive_commands(websocket):
    global active_profile, active_session_id, paused

    async for raw in websocket:
        message = json.loads(raw)
        message_type = message.get("type")
        if message_type == "START_PROFILE":
            active_session_id = message.get("session_id") or active_session_id
            command = message.get("command", {})
            active_profile = command.get("profile_name", command.get("profile_id", active_profile))
            paused = False
            print(f"START_PROFILE received session={active_session_id} profile={active_profile}")
        elif message_type == "PAUSE_PROFILE":
            paused = True
            print("PAUSE_PROFILE received")
        elif message_type == "RESUME_PROFILE":
            if active_session_id:
                paused = False
            print("RESUME_PROFILE received")
        elif message_type == "STOP_PROFILE":
            active_session_id = None
            active_profile = "IDLE"
            paused = True
            print("STOP_PROFILE received")
        else:
            print(raw)


async def send_telemetry(websocket):
    index = 0
    while True:
        if active_session_id and not paused:
            packet = make_packet(index)
            await websocket.send(json.dumps({"type": "telemetry", "payload": packet}))
            index += 1
        await asyncio.sleep(1)


async def main():
    try:
        async with websockets.connect(SERVER_URL, open_timeout=15) as websocket:
            print(f"Connected to {SERVER_URL}")
            await asyncio.gather(receive_commands(websocket), send_telemetry(websocket))
    except TimeoutError:
        print(f"Timed out connecting to {SERVER_URL}")
        print("Check backend is running with --host 0.0.0.0, laptop IP is correct, and firewall allows port 8000.")


if __name__ == "__main__":
    asyncio.run(main())

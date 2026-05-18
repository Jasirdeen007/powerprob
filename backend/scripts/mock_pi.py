import asyncio
import random
from datetime import datetime

import websockets


SERVER_URL = "ws://127.0.0.1:8000/ws/pi"
SESSION_ID = "SESSION_MOCK_PI_B0047"


def make_packet(index: int) -> dict:
    cell1 = round(3.96 - index * 0.002 + random.uniform(-0.01, 0.01), 2)
    cell2 = round(3.95 - index * 0.002 + random.uniform(-0.01, 0.01), 2)
    cell3 = round(3.94 - index * 0.002 + random.uniform(-0.01, 0.01), 2)
    current = round(7.8 + random.uniform(-0.8, 1.4), 2)
    battery_temp = round(33 + index * 0.08 + random.uniform(-0.3, 0.5), 1)

    return {
        "session_id": SESSION_ID,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "mode": "DISCHARGE",
        "profile": "PULSE",
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


async def main():
    async with websockets.connect(SERVER_URL) as websocket:
        print(f"Connected to {SERVER_URL}")
        index = 0
        while True:
            packet = make_packet(index)
            await websocket.send(
                __import__("json").dumps(
                    {"type": "telemetry", "payload": packet}
                )
            )
            reply = await websocket.recv()
            print(reply)
            index += 1
            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())

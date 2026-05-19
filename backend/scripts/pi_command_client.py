import asyncio
import json
import os
import sys

import websockets


SERVER_URL = sys.argv[1] if len(sys.argv) > 1 else os.getenv("POWERPROBE_WS_URL", "ws://127.0.0.1:8000/ws/pi")


async def handle_command(websocket, message: dict):
    command_type = message.get("type")
    if command_type in {"ack", "telemetry_ack"}:
        print(f"Backend acknowledgement: {json.dumps(message.get('payload', {}))}")
        return

    session_id = message.get("session_id")
    command = message.get("command", {})

    print(f"Command received type={command_type} session_id={session_id}")
    print(json.dumps(command, indent=2))

    # Put Raspberry Pi GPIO / relay / PWM code here.
    # Example:
    # if command.get("relay") == 1:
    #     GPIO.output(RELAY_PIN, GPIO.HIGH)
    # elif command.get("relay") == 0:
    #     GPIO.output(RELAY_PIN, GPIO.LOW)

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


async def main():
    while True:
        try:
            async with websockets.connect(SERVER_URL, open_timeout=15) as websocket:
                print(f"Connected to {SERVER_URL}")
                async for raw in websocket:
                    try:
                        message = json.loads(raw)
                    except json.JSONDecodeError:
                        print(f"Ignoring non-JSON message: {raw}")
                        continue

                    await handle_command(websocket, message)
        except (OSError, TimeoutError, websockets.WebSocketException) as error:
            print(f"WebSocket disconnected: {error}. Reconnecting in 3 seconds...")
            await asyncio.sleep(3)


if __name__ == "__main__":
    asyncio.run(main())

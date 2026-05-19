# PowerProbe Backend

FastAPI backend for the PowerProbe battery test workflow.

## What It Does

- Starts and ends battery test sessions.
- Keeps a persistent WebSocket endpoint for Raspberry Pi at `/ws/pi`.
- Receives telemetry JSON from Pi or a test client.
- Calculates simple derived metrics: SOC, SOH, RUL, and IR.
- Writes latest telemetry to Firebase RTDB at `/telemetry/{sessionId}/latest`.
- Appends packet history to Firestore at `sessions/{sessionId}/telemetry`.
- Keeps drone profile command payloads blank until hardware data is finalized.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Add Firebase values to `.env` when credentials are ready:

```txt
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
```

The backend still runs without Firebase credentials for local API testing.

## Run

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API docs:

```txt
http://127.0.0.1:8000/docs
```

Logs are written to:

```txt
backend/logs/backend.log
```

## Test Telemetry Without Hardware

```bash
curl -X POST http://127.0.0.1:8000/telemetry ^
  -H "Content-Type: application/json" ^
  -d "{\"session_id\":\"SESSION_TEST_B0047\",\"timestamp\":\"2026-05-18T10:15:32\",\"mode\":\"DISCHARGE\",\"profile\":\"PULSE\",\"pack_voltage\":11.84,\"cell_voltage\":{\"cell1\":3.96,\"cell2\":3.94,\"cell3\":3.94},\"current\":8.42,\"temperature\":{\"battery\":34.2,\"mosfet\":46.8,\"ambient\":29.1},\"event\":\"LOAD_SPIKE\"}"
```

## Run Smoke Tests

Start the backend first, then run:

```bash
pytest tests
```

These tests hit the actual running server at `http://127.0.0.1:8000`.

## Run Mock Pi WebSocket Client

Start the backend first, then run:

```bash
python scripts/mock_pi.py
```

It connects to `/ws/pi`, sends fake telemetry every second, and prints server acknowledgements.

## Send Data To Raspberry Pi Over WebSocket

Start the backend so the Pi can reach it on your network:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On the Raspberry Pi, keep this websocket client running:

```bash
python scripts/pi_command_client.py ws://YOUR_LAPTOP_IP:8000/ws/pi
```

From the backend machine, send any command JSON to the connected Pi:

```bash
python scripts/send_to_pi.py --base-url http://127.0.0.1:8000 --type CUSTOM_COMMAND --session-id SESSION_TEST --command "{\"relay\":1,\"pwm\":70}"
```

The backend delivers this to the Pi over the active `/ws/pi` websocket:

```json
{
  "type": "CUSTOM_COMMAND",
  "session_id": "SESSION_TEST",
  "command": {
    "relay": 1,
    "pwm": 70
  }
}
```

## Start Session

```json
{
  "battery_id": "B0047",
  "config": {
    "chemistry": "Li-ion",
    "cell_count": 3,
    "capacity_ah": 2.2,
    "drone_type": "SURVEILLANCE",
    "discharge_profile": "PULSE"
  }
}
```

The command sent to Raspberry Pi is currently:

```json
{
  "type": "START_PROFILE",
  "session_id": "SESSION_ID",
  "command": {}
}
```

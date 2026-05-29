# PowerProbe Backend

FastAPI backend for the PowerProbe battery test workflow.

## What It Does

- Starts and ends battery test sessions.
- Connects to an MQTT broker on startup.
- Subscribes to Pi telemetry at `{MQTT_TOPIC_PREFIX}/+/telemetry`.
- Subscribes to Pi heartbeat/status at `{MQTT_TOPIC_PREFIX}/+/status`.
- Publishes commands to `{MQTT_TOPIC_PREFIX}/{deviceId}/command`.
- Writes active telemetry to user-scoped Firebase RTDB at `users/{userId}/telemetry/{sessionId}/latest` and `users/{userId}/telemetry/{sessionId}/packets/{packetId}`.
- On session end, copies RTDB packets to user-scoped Firestore at `users/{userId}/sessions/{sessionId}/telemetry`, marks the session completed, and clears `users/{userId}/telemetry/{sessionId}`.
- Keeps `POST /telemetry` as a development fallback using the same validation path.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Add Firebase and MQTT values to `.env`:

```txt
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
MQTT_HOST=broker.emqx.io
MQTT_PORT=1883
MQTT_TOPIC_PREFIX=powerprobe/team6
MQTT_DEFAULT_DEVICE_ID=pi-001
MQTT_PREFER_IPV4=false
```

The backend still runs without Firebase credentials. If `paho-mqtt` is not installed, MQTT is disabled but the HTTP API can still boot.

## MQTT Broker

The current lab setup uses public EMQX:

```txt
broker.emqx.io:1883
```

Both the backend and the Pi connect outward to this broker, so the backend does not need the Pi LAN IP, mDNS, SSH, or router port forwarding for normal operation.

Shared topic namespace:

```txt
powerprobe/team6
```

Local Mosquitto on the Pi is no longer used. Stop it on the Pi to avoid confusing tests:

```bash
sudo systemctl stop mosquitto
sudo systemctl disable mosquitto
```

## Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

API docs:

```txt
http://127.0.0.1:8001/docs
```

## Telemetry Contract

Pi publishes to `{MQTT_TOPIC_PREFIX}/{deviceId}/telemetry`, for example `powerprobe/team6/pi-001/telemetry`:

```json
{
  "session_id": "SESSION_20260518_101532_B0047",
  "battery_id": "B0047",
  "battery_name": "Drone Pack A",
  "timestamp": "2026-05-18T10:15:32Z",
  "mode": "DISCHARGE",
  "pack_voltage": 11.84,
  "cell_voltage": {
    "cell1": 3.96,
    "cell2": 3.94,
    "cell3": 3.94
  },
  "current": 8.42,
  "temperature": {
    "battery": 34.2,
    "mosfet": 46.8,
    "ambient": 29.1
  },
  "event": "LOAD_SPIKE"
}
```

`profile` is no longer part of telemetry. `pack_voltage`, `cell_voltage`, and `current` may be omitted for temperature-only hardware.

HTTP fallback:

```bash
curl -X POST http://127.0.0.1:8001/telemetry ^
  -H "Content-Type: application/json" ^
  -d "{\"session_id\":\"SESSION_TEST_B0047\",\"battery_id\":\"B0047\",\"timestamp\":\"2026-05-18T10:15:32Z\",\"mode\":\"DISCHARGE\",\"pack_voltage\":11.84,\"cell_voltage\":{\"cell1\":3.96,\"cell2\":3.94,\"cell3\":3.94},\"current\":8.42,\"temperature\":{\"battery\":34.2,\"mosfet\":46.8,\"ambient\":29.1},\"event\":\"LOAD_SPIKE\"}"
```

## Raspberry Pi MQTT Client

Use `scripts/powerprobe_pi_mqtt.py` on the Pi. It:

- Publishes heartbeat/status to `{POWERPROBE_MQTT_TOPIC_PREFIX}/{deviceId}/status`.
- Subscribes for backend commands on `{POWERPROBE_MQTT_TOPIC_PREFIX}/{deviceId}/command`.
- Runs received `START_PROFILE` control points.
- Publishes telemetry to `{POWERPROBE_MQTT_TOPIC_PREFIX}/{deviceId}/telemetry`.

Install on the Pi:

```bash
mkdir -p /home/team6/powerprobe
cp powerprobe_pi_mqtt.py /home/team6/powerprobe/
cp powerprobe-pi-mqtt.service.example /home/team6/powerprobe/
cd /home/team6/powerprobe
sudo apt update
sudo apt install -y python3-venv python3-full mosquitto-clients
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install paho-mqtt
nano powerprobe-pi-mqtt.service.example
sudo cp powerprobe-pi-mqtt.service.example /etc/systemd/system/powerprobe-pi.service
sudo systemctl daemon-reload
sudo systemctl enable --now powerprobe-pi.service
sudo systemctl status powerprobe-pi.service
```

Edit these values in the service before installing it:

```txt
POWERPROBE_MQTT_HOST=broker.emqx.io
POWERPROBE_MQTT_PORT=1883
POWERPROBE_MQTT_TOPIC_PREFIX=powerprobe/team6
POWERPROBE_MQTT_PREFER_IPV4=true
POWERPROBE_DEVICE_ID=pi-001
POWERPROBE_BATTERY_ID=TEAM6_PACK_1
```

Live Pi logs:

```bash
journalctl -u powerprobe-pi.service -f
```

Replace `apply_output()` and `read_telemetry()` in `powerprobe_pi_mqtt.py` with your real GPIO/DAC/PWM and sensor code. If only temperature is available, omit `pack_voltage`, `cell_voltage`, and `current`.

## Run Smoke Tests

Start the backend first, then run:

```bash
pytest tests
```

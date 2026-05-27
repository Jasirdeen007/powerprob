# PowerProbe Backend

FastAPI backend for the PowerProbe battery test workflow.

## What It Does

- Starts and ends battery test sessions.
- Connects to an MQTT broker on startup.
- Subscribes to Pi telemetry at `powerprobe/+/telemetry`.
- Subscribes to Pi heartbeat/status at `powerprobe/+/status`.
- Publishes commands to `powerprobe/{deviceId}/command`.
- Writes active telemetry to Firebase RTDB at `/telemetry/{sessionId}/latest` and `/telemetry/{sessionId}/packets/{packetId}`.
- On session end, copies RTDB packets to Firestore at `sessions/{sessionId}/telemetry`, marks the session completed, and clears `/telemetry/{sessionId}`.
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
MQTT_HOST=YOUR_PI_IP
MQTT_PORT=1883
MQTT_DEFAULT_DEVICE_ID=pi-001
```

The backend still runs without Firebase credentials. If `paho-mqtt` is not installed, MQTT is disabled but the HTTP API can still boot.

## Run MQTT Broker On The Pi

The recommended setup is Mosquitto running on the Raspberry Pi. The Pi script connects to `127.0.0.1`, and the backend connects to the Pi's LAN IP.

On the Pi:

```bash
sudo apt update
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable --now mosquitto
sudo systemctl status mosquitto
```

Copy `mqtt/pi-mosquitto.conf` to the Pi as `/home/pi/powerprobe/pi-mosquitto.conf`, then run:

```bash
sudo cp /home/pi/powerprobe/pi-mosquitto.conf /etc/mosquitto/conf.d/powerprobe.conf
sudo systemctl restart mosquitto
```

Backend `.env` should point to the Pi:

```txt
MQTT_HOST=YOUR_PI_IP
MQTT_PORT=1883
```

The Pi client service should point to its local broker:

```txt
POWERPROBE_MQTT_HOST=127.0.0.1
POWERPROBE_MQTT_PORT=1883
```

`docker-compose.yml` still provides an optional laptop-hosted Mosquitto broker for development, but Pi-hosted Mosquitto is the target deployment.

## Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs:

```txt
http://127.0.0.1:8000/docs
```

## Telemetry Contract

Pi publishes to `powerprobe/{deviceId}/telemetry`:

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
curl -X POST http://127.0.0.1:8000/telemetry ^
  -H "Content-Type: application/json" ^
  -d "{\"session_id\":\"SESSION_TEST_B0047\",\"battery_id\":\"B0047\",\"timestamp\":\"2026-05-18T10:15:32Z\",\"mode\":\"DISCHARGE\",\"pack_voltage\":11.84,\"cell_voltage\":{\"cell1\":3.96,\"cell2\":3.94,\"cell3\":3.94},\"current\":8.42,\"temperature\":{\"battery\":34.2,\"mosfet\":46.8,\"ambient\":29.1},\"event\":\"LOAD_SPIKE\"}"
```

## Raspberry Pi MQTT Client

Use `scripts/powerprobe_pi_mqtt.py` on the Pi. It:

- Publishes heartbeat/status to `powerprobe/{deviceId}/status`.
- Subscribes for backend commands on `powerprobe/{deviceId}/command`.
- Runs received `START_PROFILE` control points.
- Publishes telemetry to `powerprobe/{deviceId}/telemetry`.

Install on the Pi:

```bash
mkdir -p /home/pi/powerprobe
cp powerprobe_pi_mqtt.py /home/pi/powerprobe/
cp powerprobe-pi-mqtt.service.example /home/pi/powerprobe/
cp pi-mosquitto.conf /home/pi/powerprobe/
cd /home/pi/powerprobe
sudo apt update
sudo apt install -y mosquitto mosquitto-clients
sudo cp pi-mosquitto.conf /etc/mosquitto/conf.d/powerprobe.conf
sudo systemctl enable --now mosquitto
sudo systemctl restart mosquitto
python3 -m pip install --user paho-mqtt
nano powerprobe-pi-mqtt.service.example
sudo cp powerprobe-pi-mqtt.service.example /etc/systemd/system/powerprobe-pi.service
sudo systemctl daemon-reload
sudo systemctl enable --now powerprobe-pi.service
sudo systemctl status powerprobe-pi.service
```

Edit these values in the service before installing it:

```txt
POWERPROBE_MQTT_HOST=127.0.0.1
POWERPROBE_MQTT_PORT=1883
POWERPROBE_DEVICE_ID=pi-001
POWERPROBE_BATTERY_ID=B0047
```

Find the Pi IP for the backend `.env`:

```bash
hostname -I
```

Use that IP as `MQTT_HOST` on the backend machine.

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

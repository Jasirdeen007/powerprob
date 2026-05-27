# PowerProbe MQTT Broker

Recommended deployment:

```txt
Raspberry Pi
  - Mosquitto broker
  - PowerProbe Pi MQTT client

Backend/server/laptop
  - FastAPI backend
  - React frontend

Browsers
  - Connect to frontend/backend/Firebase
  - Do not connect directly to the Pi
```

This removes the old single WebSocket connection limit. The backend has one MQTT connection to the Pi-hosted broker, while many browser clients can use the web app at the same time.

## Why Broker On The Pi

- The Pi is the physical device owner.
- The Pi MQTT client can publish telemetry to `127.0.0.1`.
- The backend can reconnect to the Pi broker after network drops.
- Multiple web clients do not compete for a direct Pi connection.
- The broker can support additional clients/debug subscribers without replacing the active Pi connection.

One physical Pi should still run only one active test session at a time. The backend now rejects competing session starts for the same device with HTTP `409`.

## Install Mosquitto On Raspberry Pi

On the Pi:

```bash
sudo apt update
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable --now mosquitto
sudo systemctl status mosquitto
```

For the lab setup, copy this repo's Pi broker config:

```bash
sudo cp /home/pi/powerprobe/pi-mosquitto.conf /etc/mosquitto/conf.d/powerprobe.conf
sudo systemctl restart mosquitto
sudo systemctl status mosquitto
```

If your Pi username is not `pi`, adjust the source path.

## Backend Settings

The backend connects to the broker running on the Pi:

```txt
MQTT_HOST=YOUR_PI_IP
MQTT_PORT=1883
MQTT_DEFAULT_DEVICE_ID=pi-001
```

Example:

```txt
MQTT_HOST=192.168.1.80
MQTT_PORT=1883
MQTT_DEFAULT_DEVICE_ID=pi-001
```

## Pi Client Settings

Because the broker runs on the Pi, the Pi client connects locally:

```txt
POWERPROBE_MQTT_HOST=127.0.0.1
POWERPROBE_MQTT_PORT=1883
POWERPROBE_DEVICE_ID=pi-001
POWERPROBE_BATTERY_ID=B0047
```

## Test On The Pi

Watch status:

```bash
mosquitto_sub -h 127.0.0.1 -t "powerprobe/+/status" -v
```

Watch telemetry:

```bash
mosquitto_sub -h 127.0.0.1 -t "powerprobe/+/telemetry" -v
```

Send a command:

```bash
mosquitto_pub -h 127.0.0.1 -t "powerprobe/pi-001/command" -m '{"type":"STOP_PROFILE","session_id":"SESSION_TEST","command":{"reason":"manual_test"}}'
```

## Test From Backend Machine

If Mosquitto clients are installed on the backend machine:

```bash
mosquitto_sub -h YOUR_PI_IP -t "powerprobe/+/status" -v
```

Or use the backend endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/pi/status
```

## Optional Docker Broker

`docker-compose.yml` is kept as a development fallback when you want a broker on the laptop instead of the Pi:

```bash
docker compose up -d mqtt-broker
```

For your target setup, prefer native Mosquitto on the Pi.

## Security

The provided lab config uses:

```txt
allow_anonymous true
```

Use this only on a trusted local network. For production/shared networks, set `allow_anonymous false`, add a Mosquitto password file, and firewall port `1883`.

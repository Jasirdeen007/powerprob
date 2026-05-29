# PowerProbe MQTT

Current deployment:

```txt
Raspberry Pi
  - PowerProbe Pi MQTT client
  - no local Mosquitto required

Public MQTT broker
  - broker.emqx.io:1883

Backend/server/laptop
  - FastAPI backend
  - React frontend

Browsers
  - Connect to frontend/backend/Firebase
  - Do not connect directly to MQTT or the Pi
```

Both the Pi and backend connect outward to public EMQX. This removes the need for static Pi IP, mDNS reliability, SSH tunnels, or router port forwarding during normal website operation.

## Broker

```txt
MQTT_HOST=broker.emqx.io
MQTT_PORT=1883
MQTT_TOPIC_PREFIX=powerprobe/team6
```

Final topics:

```txt
powerprobe/team6/pi-001/status
powerprobe/team6/pi-001/telemetry
powerprobe/team6/pi-001/command
```

Public EMQX is for lab testing only. Topics are not private, and this setup has no TLS, username, or password.

## Backend Settings

Use these values in `backend/.env`:

```txt
MQTT_HOST=broker.emqx.io
MQTT_PORT=1883
MQTT_TOPIC_PREFIX=powerprobe/team6
MQTT_DEFAULT_DEVICE_ID=pi-001
MQTT_PREFER_IPV4=false
```

## Pi Client Settings

Use these values in the Pi systemd service:

```txt
POWERPROBE_MQTT_HOST=broker.emqx.io
POWERPROBE_MQTT_PORT=1883
POWERPROBE_MQTT_TOPIC_PREFIX=powerprobe/team6
POWERPROBE_MQTT_PREFER_IPV4=true
POWERPROBE_DEVICE_ID=pi-001
POWERPROBE_BATTERY_ID=TEAM6_PACK_1
```

Local Mosquitto on the Pi is no longer used. Stop it to avoid confusing debugging:

```bash
sudo systemctl stop mosquitto
sudo systemctl disable mosquitto
```

## Test MQTT

From the Pi or any machine with Mosquitto clients:

```bash
mosquitto_sub -h broker.emqx.io -p 1883 -t "powerprobe/team6/#" -v
```

You should see Pi status messages before a session starts. Telemetry appears after the backend publishes `START_PROFILE`.

Manual stop command:

```bash
mosquitto_pub -h broker.emqx.io -p 1883 -t "powerprobe/team6/pi-001/command" -m '{"type":"STOP_PROFILE","session_id":"SESSION_TEST","command":{"reason":"manual_test"}}'
```

Backend endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/pi/status
```

Expected:

```txt
broker: broker.emqx.io:1883
topic_prefix: powerprobe/team6
mqtt_connected: True
```

## Optional Local Broker

`docker-compose.yml` and `mosquitto.conf` remain useful only as a local development fallback. They are not part of the current EMQX flow.

For production, replace public EMQX with EMQX Cloud or another authenticated MQTT broker using TLS and credentials.

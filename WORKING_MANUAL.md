# PowerProbe Working Manual

This manual describes the current working setup for the PowerProbe website, backend, Raspberry Pi MQTT bridge, public EMQX broker, and Firebase.

## Current Architecture

```txt
Multiple website clients
  -> React frontend
  -> FastAPI backend on port 8001
  -> Public EMQX MQTT broker
  -> Pi MQTT script
  -> User-scoped Firebase RTDB/Firestore
```

Important rule:

```txt
Browsers do not connect directly to the Pi.
```

Browsers use the backend and Firebase. The backend is the only service that sends commands to the Pi. MQTT replaces the old single WebSocket Pi connection.

The Pi and backend both connect outward to:

```txt
broker.emqx.io:1883
```

Shared topic namespace:

```txt
powerprobe/team6
```

## Firebase Data Layout

Live telemetry is user-scoped in RTDB:

```txt
users/{userId}/telemetry/{sessionId}/latest
users/{userId}/telemetry/{sessionId}/packets/{packetId}
```

Completed history is user-scoped in Firestore:

```txt
users/{userId}/sessions/{sessionId}
users/{userId}/sessions/{sessionId}/telemetry/{packetId}
```

The frontend sends the current Firebase Auth `uid` to the backend when starting/stopping sessions. In local non-auth mode, it uses:

```txt
local-demo-user
```

History Analytics reads completed Firestore sessions only for the current user.

## Device Values

Current Pi:

```txt
SSH/mDNS: team6@team6.local, setup/debug only
Pi IP: not required for normal MQTT flow
MQTT port: 1883
Device ID: pi-001
Backend port: 8001
Frontend port: 5173
```

Do not use the Pi IP as the MQTT broker address in the EMQX flow.

## Important Env Files

Backend reads this file:

```txt
backend/.env
```

Backend does not read:

```txt
backend/.venv/.env
```

Frontend reads:

```txt
frontend/.env
```

## Backend Env

File:

```txt
D:\battery_website\backend\.env
```

Required MQTT values:

```txt
MQTT_HOST=broker.emqx.io
MQTT_PORT=1883
MQTT_TOPIC_PREFIX=powerprobe/team6
MQTT_DEFAULT_DEVICE_ID=pi-001
MQTT_HEARTBEAT_STALE_SECONDS=45
MQTT_PREFER_IPV4=false
```

Firebase values are also in this file.

The backend APIs require `user_id` for user-scoped data:

```txt
GET /sessions?user_id={userId}
GET /historical?session_id={sessionId}&user_id={userId}
GET /telemetry/live?user_id={userId}
POST /session/start  body includes user_id
POST /session/end    body includes user_id
```

## Frontend Env

File:

```txt
D:\battery_website\frontend\.env
```

Set:

```txt
VITE_API_BASE_URL=http://127.0.0.1:8001
```

## MQTT Broker Setup

The current lab setup uses public EMQX:

```txt
broker.emqx.io:1883
```

Local Mosquitto on the Pi is no longer needed. Stop and disable it to avoid confusion:

```bash
sudo systemctl stop mosquitto
sudo systemctl disable mosquitto
```

Public EMQX is for lab testing only. Topics are not private.

## Pi MQTT Script Setup

Files copied to Pi:

```txt
/home/team6/powerprobe/powerprobe_pi_mqtt.py
/home/team6/powerprobe/powerprobe-pi-mqtt.service.example
```

Use a Python virtual environment on Pi:

```bash
cd /home/team6/powerprobe
sudo apt install -y python3-venv python3-full
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install paho-mqtt
```

Systemd service should contain:

```txt
[Service]
Type=simple
User=team6
WorkingDirectory=/home/team6/powerprobe
Environment=POWERPROBE_MQTT_HOST=broker.emqx.io
Environment=POWERPROBE_MQTT_PORT=1883
Environment=POWERPROBE_MQTT_TOPIC_PREFIX=powerprobe/team6
Environment=POWERPROBE_MQTT_PREFER_IPV4=true
Environment=POWERPROBE_DEVICE_ID=pi-001
Environment=POWERPROBE_BATTERY_ID=TEAM6_PACK_1
Environment=POWERPROBE_STATE_FILE=/home/team6/powerprobe/latest_profile.json
ExecStart=/home/team6/powerprobe/.venv/bin/python -u /home/team6/powerprobe/powerprobe_pi_mqtt.py
Restart=always
RestartSec=3
```

Install/restart service:

```bash
sudo cp powerprobe-pi-mqtt.service.example /etc/systemd/system/powerprobe-pi.service
sudo systemctl daemon-reload
sudo systemctl enable --now powerprobe-pi.service
sudo systemctl restart powerprobe-pi.service
sudo systemctl status powerprobe-pi.service
```

Watch logs:

```bash
journalctl -u powerprobe-pi.service -f
```

If the service shows `ConnectionRefusedError`, copy the latest script and service again, then restart systemd. The current Pi script uses async reconnect and should not exit just because one broker connection attempt is refused.

## Copy Files To Pi

From Windows project root:

```powershell
cd D:\battery_website
ssh team6@team6.local "mkdir -p /home/team6/powerprobe"
scp backend\scripts\powerprobe_pi_mqtt.py team6@team6.local:/home/team6/powerprobe/
scp backend\scripts\powerprobe-pi-mqtt.service.example team6@team6.local:/home/team6/powerprobe/
```

## Run Backend

From Windows PowerShell:

```powershell
cd D:\battery_website\backend
.\.venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

Pi/MQTT status:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/pi/status
```

Expected broker:

```txt
broker : broker.emqx.io:1883
broker_resolved : broker.emqx.io:1883
topic_prefix : powerprobe/team6
```

Expected when Pi is connected:

```txt
connected        : True
mqtt_connected   : True
transport        : mqtt
devices          : pi-001
```

## Run Frontend

From Windows PowerShell:

```powershell
cd D:\battery_website\frontend
npm run dev
```

Open:

```txt
http://127.0.0.1:5173
```

## Test Connectivity

From Windows:

```powershell
Test-NetConnection broker.emqx.io -Port 1883
```

Expected:

```txt
TcpTestSucceeded : True
```

If false, the computer cannot reach the public EMQX broker.

From Pi or any machine with Mosquitto clients, watch all PowerProbe MQTT messages:

```bash
mosquitto_sub -h broker.emqx.io -p 1883 -t "powerprobe/team6/#" -v
```

You should see status messages before a session starts.

Telemetry appears only after backend sends `START_PROFILE`.

## Website Flow Test

1. Start `powerprobe-pi.service` on Pi.
2. Confirm it connects to `broker.emqx.io`.
3. Start backend on port `8001`.
4. Start frontend on port `5173`.
5. Open Dashboard.
6. Confirm Pi banner shows `Pi available`.
7. Click `Run`.
8. Pi receives command on:

```txt
powerprobe/team6/pi-001/command
```

9. Pi starts sending mock telemetry on:

```txt
powerprobe/team6/pi-001/telemetry
```

10. Dashboard should show `Pi data receiving`.
11. Click `Stop`.

## Manual Backend Session Start

From Windows PowerShell:

```powershell
$body = @{
  battery_id = "TEAM6_PACK_1"
  user_id = "local-demo-user"
  config = @{
    chemistry = "Li-ion"
    cell_count = 3
    capacity_ah = 2.2
    drone_type = "Surveillance Drone"
    discharge_profile = "PULSE"
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod http://127.0.0.1:8001/session/start -Method Post -ContentType "application/json" -Body $body
```

End:

```powershell
$body = @{
  session_id = "PASTE_SESSION_ID_HERE"
  user_id = "local-demo-user"
} | ConvertTo-Json

Invoke-RestMethod http://127.0.0.1:8001/session/end -Method Post -ContentType "application/json" -Body $body
```

Historical packets:

```powershell
Invoke-RestMethod "http://127.0.0.1:8001/historical?session_id=PASTE_SESSION_ID_HERE&user_id=local-demo-user"
```

## Troubleshooting

If `/pi/status` shows:

```txt
broker : 127.0.0.1:1883
```

then backend is not reading the correct env file. Edit:

```txt
backend/.env
```

and restart uvicorn.

If `/pi/status` shows:

```txt
mqtt_connected : True
connected      : False
devices        :
```

then backend connected to a broker, but has not received Pi heartbeat. Check:

```bash
sudo systemctl status powerprobe-pi.service
journalctl -u powerprobe-pi.service -f
```

If the backend machine cannot reach EMQX:

```powershell
Test-NetConnection broker.emqx.io -Port 1883
```

then the backend machine does not have internet access to EMQX.

If pip shows `externally-managed-environment`, use the Pi virtual environment setup in this manual.

## Why No Static Pi IP Is Needed Now

The Pi IP can change when it reconnects to Wi-Fi, but that no longer matters for normal operation. The Pi opens an outbound MQTT connection to `broker.emqx.io`, and the backend opens a separate outbound MQTT connection to the same broker. Neither side needs to know the Pi LAN IP.

SSH/mDNS such as `team6@team6.local` is only needed to copy files, install the service, or debug the Pi.

## Notes

- `B0047` was only a sample battery ID. Use `TEAM6_PACK_1` or your real battery ID.
- One physical Pi should run only one active test session at a time.
- Multiple website clients can view/use the site, but competing session starts for the same Pi should be rejected.
- Pi telemetry is mock data until `read_telemetry()` in `powerprobe_pi_mqtt.py` is replaced with real sensor reads.

# PowerProbe Working Manual

This manual describes the current working setup for the PowerProbe website, backend, Raspberry Pi MQTT bridge, and Pi-hosted Mosquitto broker.

## Current Architecture

```txt
Multiple website clients
  -> React frontend
  -> FastAPI backend on port 8001
  -> MQTT broker running on Raspberry Pi
  -> Pi MQTT script
  -> Firebase RTDB/Firestore
```

Important rule:

```txt
Browsers do not connect directly to the Pi.
```

Browsers use the backend and Firebase. The backend is the only service that sends commands to the Pi. MQTT replaces the old single WebSocket Pi connection.

## Device Values

Current Pi:

```txt
SSH/mDNS: team6@team6.local
Pi IP: 172.25.70.251
MQTT port: 1883
Device ID: pi-001
Backend port: 8001
Frontend port: 5173
```

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
MQTT_HOST=172.25.70.251
MQTT_PORT=1883
MQTT_DEFAULT_DEVICE_ID=pi-001
MQTT_HEARTBEAT_STALE_SECONDS=45
```

Firebase values are also in this file.

## Frontend Env

File:

```txt
D:\battery_website\frontend\.env
```

Set:

```txt
VITE_API_BASE_URL=http://127.0.0.1:8001
```

## Pi Broker Setup

Mosquitto should run on the Raspberry Pi.

On Pi:

```bash
sudo apt update
sudo apt install -y mosquitto mosquitto-clients
```

Mosquitto config:

```bash
sudo tee /etc/mosquitto/conf.d/powerprobe.conf > /dev/null <<'EOF'
listener 1883 0.0.0.0
allow_anonymous true
EOF
```

Restart:

```bash
sudo systemctl reset-failed mosquitto
sudo systemctl restart mosquitto
sudo systemctl status mosquitto
```

Check that it listens on LAN:

```bash
sudo ss -ltnp | grep 1883
```

Expected:

```txt
0.0.0.0:1883
```

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
Environment=POWERPROBE_MQTT_HOST=127.0.0.1
Environment=POWERPROBE_MQTT_PORT=1883
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

## Copy Files To Pi

From Windows project root:

```powershell
cd D:\battery_website
ssh team6@team6.local "mkdir -p /home/team6/powerprobe"
scp backend\scripts\powerprobe_pi_mqtt.py team6@team6.local:/home/team6/powerprobe/
scp backend\scripts\powerprobe-pi-mqtt.service.example team6@team6.local:/home/team6/powerprobe/
scp mqtt\pi-mosquitto.conf team6@team6.local:/home/team6/powerprobe/
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
broker : 172.25.70.251:1883
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
Test-NetConnection 172.25.70.251 -Port 1883
```

Expected:

```txt
TcpTestSucceeded : True
```

If false, Mosquitto is not reachable from Windows. Check Pi broker config and firewall/network.

From Pi, watch all PowerProbe MQTT messages:

```bash
mosquitto_sub -h 127.0.0.1 -t "powerprobe/#" -v
```

You should see status messages before a session starts.

Telemetry appears only after backend sends `START_PROFILE`.

## Website Flow Test

1. Start Mosquitto on Pi.
2. Start `powerprobe-pi.service` on Pi.
3. Start backend on port `8001`.
4. Start frontend on port `5173`.
5. Open Dashboard.
6. Confirm Pi banner shows `Pi available`.
7. Click `Run`.
8. Pi receives command on:

```txt
powerprobe/pi-001/command
```

9. Pi starts sending mock telemetry on:

```txt
powerprobe/pi-001/telemetry
```

10. Dashboard should show `Pi data receiving`.
11. Click `Stop`.

## Manual Backend Session Start

From Windows PowerShell:

```powershell
$body = @{
  battery_id = "TEAM6_PACK_1"
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

End session:

```powershell
$body = @{ session_id = "PASTE_SESSION_ID_HERE" } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8001/session/end -Method Post -ContentType "application/json" -Body $body
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

If Windows cannot reach Pi broker:

```powershell
Test-NetConnection 172.25.70.251 -Port 1883
```

then on Pi check:

```bash
sudo systemctl status mosquitto
sudo ss -ltnp | grep 1883
cat /etc/mosquitto/conf.d/powerprobe.conf
```

If pip shows `externally-managed-environment`, use the Pi virtual environment setup in this manual.

## Notes

- `B0047` was only a sample battery ID. Use `TEAM6_PACK_1` or your real battery ID.
- One physical Pi should run only one active test session at a time.
- Multiple website clients can view/use the site, but competing session starts for the same Pi should be rejected.
- Pi telemetry is mock data until `read_telemetry()` in `powerprobe_pi_mqtt.py` is replaced with real sensor reads.

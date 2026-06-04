# PowerProbe Battery Analytics

PowerProbe is a cloud-connected battery test analytics and traceability platform for drone battery workflows. It combines a React dashboard, a FastAPI backend, Firebase storage, MQTT messaging, and a Raspberry Pi bridge so users can start battery test sessions, stream telemetry, monitor health indicators, and review completed test history.

The current project is a working lab prototype. The website, backend APIs, Firebase integration, MQTT bridge, Pi service script, local demo dataset, and history analytics flow are implemented. Pi telemetry is still mock/generated until `read_telemetry()` in the Pi script is replaced with real sensor reads.

## Current Status

- React + Vite frontend with Firebase Auth when Firebase env values are present.
- Local demo fallback when Firebase is not configured.
- FastAPI backend on port `8001` for sessions, telemetry, Pi commands, live data, and historical data.
- Firebase Realtime Database for active live telemetry.
- Firestore for completed user-scoped test sessions and historical telemetry.
- MQTT bridge through public EMQX at `broker.emqx.io:1883`.
- Raspberry Pi MQTT script that receives backend commands and publishes telemetry/status.
- Dashboard session controls for run, stop, pause, resume, and Pi availability.
- History Analytics page with filters, metrics, charts, and CSV/JSON export utilities.
- Bundled demo data remains available for offline/demo usage.

## Architecture

```txt
React frontend
  -> FastAPI backend
  -> MQTT broker
  -> Raspberry Pi MQTT client
  -> Firebase RTDB + Firestore
```

Browsers do not connect directly to the Pi. The frontend talks to the backend and Firebase. The backend is responsible for sending commands to the Pi through MQTT.

Current lab MQTT values:

```txt
Broker: broker.emqx.io:1883
Topic prefix: powerprobe/team6
Default device ID: pi-001
```

Public EMQX is suitable for lab testing only. Topics are not private.

## Main Features

**Dashboard**

- Live KPI cards for pack voltage, current, temperature, SOC, SOH, and runtime.
- Live telemetry charts using Recharts.
- Pi status banner and backend connectivity checks.
- Start/stop/pause/resume controls for Pi-backed battery test sessions.
- Charge/discharge configuration modals.
- Firebase live data subscription with backend polling fallback.

**History Analytics**

- User-scoped completed session history.
- Battery, mode, and date filtering.
- Voltage, current, temperature, and mode distribution visualizations.
- Summary metrics such as average voltage/current/temperature, max temperature, reading count, and voltage range.
- Export helpers for CSV and JSON.

**Backend**

- Starts and ends sessions.
- Publishes Pi commands to MQTT.
- Receives MQTT telemetry and HTTP fallback telemetry.
- Stores active telemetry in Firebase RTDB.
- Moves completed session telemetry into Firestore on session end.
- Provides `/health`, `/pi/status`, `/profiles`, `/sessions`, `/telemetry/live`, and `/historical` endpoints.

**Raspberry Pi Bridge**

- Connects outward to MQTT.
- Publishes heartbeat/status messages.
- Receives `START_PROFILE`, `PAUSE_PROFILE`, `RESUME_PROFILE`, and stop-style commands.
- Sends telemetry packets back to the backend through MQTT.
- Currently generates mock telemetry until real sensor code is added.

## Data Layout

Active live telemetry in Realtime Database:

```txt
users/{userId}/telemetry/{sessionId}/latest
users/{userId}/telemetry/{sessionId}/packets/{packetId}
```

Completed history in Firestore:

```txt
users/{userId}/sessions/{sessionId}
users/{userId}/sessions/{sessionId}/telemetry/{packetId}
```

Legacy/demo collections are still supported by the frontend seed flow:

```txt
batteries
testSessions
testReadings
/liveReadings
```

When Firebase Auth is unavailable, the app uses the local fallback user:

```txt
local-demo-user
```

## Project Structure

```txt
battery_website/
  backend/
    main.py
    routers/
    services/
    models/
    scripts/
    tests/
    .env.example
  frontend/
    src/
      App.jsx
      backendClient.js
      firebaseClient.js
      components/
      pages/
      lib/
      data/
      demo-data.json
    public/demo-data.json
    scripts/push-demo-to-firebase.js
    package.json
  mqtt/
    README.md
    mosquitto.conf
  database/
    B0047-1-report.json
  WORKING_MANUAL.md
  docker-compose.yml
```

## Prerequisites

- Node.js and npm for the frontend.
- Python 3.11+ recommended for the backend.
- Firebase project credentials if running with cloud data.
- Internet access to `broker.emqx.io:1883` for the current MQTT flow.
- Raspberry Pi only if testing the Pi command/telemetry loop.

## Frontend Setup

From PowerShell:

```powershell
cd D:\battery_website\frontend
npm install
```

Create or update:

```txt
D:\battery_website\frontend\.env
```

Minimum local backend setting:

```txt
VITE_API_BASE_URL=http://127.0.0.1:8001
```

Firebase settings, when available:

```txt
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
```

Run the frontend:

```powershell
npm run dev
```

Open:

```txt
http://127.0.0.1:5173
```

Other frontend commands:

```powershell
npm run build
npm run preview
npm run dev:lan
npm run preview:lan
npm run firebase:seed
```

## Backend Setup

From PowerShell:

```powershell
cd D:\battery_website\backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit:

```txt
D:\battery_website\backend\.env
```

Recommended lab values:

```txt
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
MQTT_HOST=broker.emqx.io
MQTT_PORT=1883
MQTT_TOPIC_PREFIX=powerprobe/team6
MQTT_DEFAULT_DEVICE_ID=pi-001
MQTT_HEARTBEAT_STALE_SECONDS=45
MQTT_PREFER_IPV4=false
```

Run the backend:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Useful URLs:

```txt
http://127.0.0.1:8001/health
http://127.0.0.1:8001/docs
http://127.0.0.1:8001/pi/status
```

## Firebase Seed

The frontend can upload bundled demo data:

```powershell
cd D:\battery_website\frontend
npm run firebase:seed
```

This writes demo battery records, sessions, readings, and live readings. Use it only against a Firebase project intended for development/demo data.

## Raspberry Pi Setup

Copy the current MQTT Pi files to the Pi:

```powershell
cd D:\battery_website
ssh team6@team6.local "mkdir -p /home/team6/powerprobe"
scp backend\scripts\powerprobe_pi_mqtt.py team6@team6.local:/home/team6/powerprobe/
scp backend\scripts\powerprobe-pi-mqtt.service.example team6@team6.local:/home/team6/powerprobe/
```

On the Pi:

```bash
cd /home/team6/powerprobe
sudo apt install -y python3-venv python3-full
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install paho-mqtt
```

The service should use:

```txt
POWERPROBE_MQTT_HOST=broker.emqx.io
POWERPROBE_MQTT_PORT=1883
POWERPROBE_MQTT_TOPIC_PREFIX=powerprobe/team6
POWERPROBE_MQTT_PREFER_IPV4=true
POWERPROBE_DEVICE_ID=pi-001
POWERPROBE_BATTERY_ID=TEAM6_PACK_1
```

Install and start:

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

## Manual Test Flow

1. Start the Pi service.
2. Start the backend on port `8001`.
3. Start the frontend on port `5173`.
4. Open the dashboard.
5. Confirm `/pi/status` shows MQTT connected and the Pi device available.
6. Click Run from the dashboard.
7. The backend publishes to `powerprobe/team6/pi-001/command`.
8. The Pi publishes telemetry to `powerprobe/team6/pi-001/telemetry`.
9. The backend stores live packets in RTDB.
10. Click Stop.
11. The backend finalizes the session into Firestore.
12. Open History Analytics to review the completed session.

## API Quick Reference

```txt
GET  /health
GET  /profiles
GET  /sessions?user_id={userId}
POST /session/start
POST /session/end
POST /pi/command
GET  /pi/status
POST /telemetry
GET  /telemetry/live?user_id={userId}
GET  /historical?session_id={sessionId}&user_id={userId}
GET  /firebase/status
```

Example session start body:

```json
{
  "battery_id": "TEAM6_PACK_1",
  "battery_name": "Team 6 Pack 1",
  "user_id": "local-demo-user",
  "device_id": "pi-001",
  "config": {
    "chemistry": "Li-ion",
    "cell_count": 3,
    "capacity_ah": 2.2,
    "drone_type": "Surveillance Drone",
    "discharge_profile": "PULSE"
  }
}
```

## Calculations

This prototype uses simple derived values for dashboard/demo use. SOC, SOH, and RUL should be treated as prototype indicators until real battery models are validated.

Example frontend SOC estimate:

```txt
SOC = ((Voltage - 3.0) / 1.25) * 100
```

The result is clamped between `0` and `100`.

## Troubleshooting

If the frontend cannot reach the backend, confirm:

```txt
frontend/.env has VITE_API_BASE_URL=http://127.0.0.1:8001
backend is running on port 8001
```

If `/pi/status` shows `127.0.0.1:1883`, the backend is not using the intended MQTT env values. Edit `backend/.env` and restart Uvicorn.

If MQTT is connected but no Pi is available, check the Pi service logs:

```bash
sudo systemctl status powerprobe-pi.service
journalctl -u powerprobe-pi.service -f
```

If EMQX is unreachable from Windows:

```powershell
Test-NetConnection broker.emqx.io -Port 1883
```

If Firebase data does not load, the frontend falls back to bundled demo data. Check Firebase env values, backend service account configuration, and `/firebase/status`.

## Known Limits

- Pi telemetry is mock data until hardware sensor reads are implemented.
- Public EMQX topics are not private.
- Production-grade battery SOC/SOH/RUL models are not implemented yet.
- The project is a lab prototype, not a certified battery management system.
- One physical Pi should run one active test session at a time.

## More Docs

- Root working manual: `WORKING_MANUAL.md`
- Backend manual: `backend/README.md`
- MQTT notes: `mqtt/README.md`
- Dashboard feature notes: `frontend/docs/DASHBOARD_FEATURES.md`

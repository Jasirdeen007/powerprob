# Project context — battery_website

This file summarizes the repository so automation agents (analysis, containerization,
testing, or deployment agents) can quickly understand the project, how to run it,
where to find important artifacts, and what to avoid (secrets).

## High-level summary

- **Name:** battery_website
- **Purpose:** Backend API and frontend dashboard for collecting, storing, and
  visualizing telemetry from battery/power hardware (MQTT + HTTP + Firebase)
- **Languages / runtimes:** Python (backend), JavaScript / React (frontend via Vite),
  Docker-compose for local integration.

## Repo layout (important folders)

- `backend`: Python backend service. Entrypoint: `backend/main.py`.
  - Python virtualenv typically at `backend/.venv` (project uses a venv in development).
  - Python deps: `backend/requirements.txt`.
  - Routers: `backend/routers/` (API endpoints and websocket handlers).
  - Services: `backend/services/` (firebase, mqtt, telemetry, sessions).
  - `serviceAccountKey.json` is present in `backend/` — treat as a secret; do not publish.

- `frontend`: Vite + React SPA. Entry: `frontend/index.html` and `frontend/src/main.jsx`.

- `mqtt`: mosquitto configuration files for running a local MQTT broker.

- `database`: sample and generated data files (e.g., `B0047-1-report.json`).

- `tests`: pytest tests for backend; smoke test: `tests/test_smoke.py`.

- `docker-compose.yml`: integration composition (broker, backend, frontend as applicable).

## How to run (developer quick-start)

Backend (development)

1. Create and activate virtualenv inside `backend/` (repo already contains `.venv` examples):

   python -m venv .venv
   (Windows) .\.venv\Scripts\Activate.ps1
   (Unix) source .venv/bin/activate

2. Install dependencies:

   pip install -r backend/requirements.txt

3. Run the backend API:

   python backend/main.py

Frontend (development)

1. From `frontend/`:

   npm install
   npm run dev

Docker-compose

- `docker-compose.yml` can be used to bring up services for local integration; inspect it
  for port mappings and service names.

## Tests

- Run backend tests from the repo root or `backend/` using pytest:

  pytest -q

## Important files & responsibilities

- `backend/main.py`: backend app bootstrap and server.
- `backend/serviceAccountKey.json`: Firebase service account — secret.
- `frontend/package.json`: frontend scripts and dependencies.
- `docker-compose.yml`: local integration composition.
- `mqtt/mosquitto.conf`: broker configuration used in local setups.

## External services and integrations

- Firebase: backend uses a service account (see `serviceAccountKey.json`) and may push demo
  data to Firebase via scripts in `frontend/scripts/`.
- MQTT: IoT telemetry flows through an MQTT broker (configs in `mqtt/`). The backend
  includes MQTT service helpers in `backend/services/mqtt_service.py`.

## Agent guidance (actionable notes)

- Treat `backend/serviceAccountKey.json` as a secret — do not commit or print it.
- Agents that modify runtime configs should preserve `mqtt/` and `docker-compose.yml` mappings.
- Primary analysis targets: `backend/routers/`, `backend/services/`, `frontend/src/`.
- To build artifacts: frontend uses Vite (`npm run build`), backend produces no image by default
  unless a Dockerfile is added/used via `docker-compose`.
- If running automated tests, activate the backend venv and run `pytest` from repo root.

## What agents should extract

- API endpoints and websocket routes under `backend/routers/`.
- Background jobs / telemetry flows in `backend/services/telemetry.py` and `services/*`.
- Frontend routes and data dependencies in `frontend/src/` and `frontend/src/components/`.
- Any environment variables or config files referenced by `backend/main.py` or `services/config.py`.

## Notes / caveats

- The repo contains an explicit Firebase key file in `backend/` which may be intended for
  local development only. Treat it as sensitive credentials.
- Some scripts under `scripts/` and `frontend/scripts/` are convenience utilities for demo data.

---

Created for use by automation/analysis agents. If you want additional details (runtime
ports, example env vars, or to remove embedded secrets), tell me which area to expand.

# PowerProbe Battery Analytics

React + Firebase demo for a Cloud-Based Battery Test Analytics & Traceability Platform.

PowerProbe is designed for a drone/battery testing workflow where telemetry is uploaded to Firebase, visualized on a live dashboard, and preserved as battery test history for traceability and reporting.

## Current App Flow

1. The app opens on the landing page.
2. The user clicks `Login`, `Get started`, or `Open dashboard`.
3. The frontend demo login/signup form is shown.
4. After login/signup, the user enters the dashboard shell.
5. The dashboard loads Firebase data if credentials are configured.
6. If Firebase is unavailable, the app uses bundled demo telemetry from `src/demo-data.json`.
7. Users can view live charts, add battery config, simulate drone profile tests, inspect traceability, and export reports.

The current login is frontend-only. Any email/password can enter the app. Real authentication is listed under future implementation.

## Implemented Features

- Landing page with demo login/signup flow
- Sidebar dashboard layout after login
- Live Battery Dashboard with voltage, current, temperature, SOC, and SOH visuals
- Firebase client support for Firestore and Realtime Database
- Local fallback demo data using bundled `demo-data.json`
- Battery Entry page for adding battery configuration during the browser session
- Drone Profiles page for simulated drone load tests
- Traceability page for per-battery test history
- Reports page with CSV and JSON export
- Logout action returning the user to the landing page
- Firebase seed script for uploading bundled demo data

## Pages

**Landing / Login**

Shows the product entry screen and demo login/signup forms. This currently updates local React state only.

**Dashboard**

Shows live telemetry as KPI cards and charts. It reads from Firebase when available, otherwise from bundled demo data.

**Battery Entry**

Lets the user enter battery ID, chemistry, manufacturer, test location, nominal capacity, and initial status. Entries are currently stored in local React state.

**Drone Profiles**

Creates simulated drone mission tests. Running a profile generates voltage, current, temperature, SOH, and status values, then adds the result to dashboard data and traceability history.

**Traceability**

Shows test sessions for the selected battery with date, source, SOH, max temperature, and average voltage.

**Reports**

Exports the selected test session as CSV or JSON.

## Data Flow

Firebase path:

- Firestore `batteries`: battery detail records
- Firestore `testSessions`: session metadata and summaries
- Firestore `testReadings`: detailed readings for each session
- Realtime Database `/liveReadings`: live stream used by the dashboard

Fallback path:

- `src/demo-data.json`: imported directly by the React app
- `public/demo-data.json`: used by the Firebase seed script

The raw NASA dataset folder and archive are not required for the app anymore. The bundled demo JSON is kept because it gives the dashboard a large fallback dataset without shipping the raw source dataset.

## Run Locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```txt
http://127.0.0.1:5173/
```b=

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Firebase Setup

Create a `.env` file in the project root beside `package.json`:

```txt
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

```

After adding `.env`, restart the dev server.

## Firebase Seed

To upload bundled demo data to Firebase:

```bash
npm run firebase:seed
```

This writes:

- `batteries`
- `testSessions`
- `testReadings`
- Realtime Database `/liveReadings`

## SOC And SOH

This version uses simple frontend/demo calculations, not production battery models.

SOC is estimated from voltage:

```txt
SOC = ((Voltage - 3.0) / 1.25) * 100
```

The result is clamped between `0` and `100`.

SOH is read from session summaries or updated by the drone profile simulation. Production SOH should be calculated using validated battery models or backend ML.

## Project Structure

```txt
src/
  App.jsx
  main.jsx
  demo-data.json
  firebaseClient.js
  styles.css
  components/
    ChartBlock.jsx
    LineChart.jsx
    MetricCard.jsx
    Sidebar.jsx
  data/
    appConfig.js
  lib/
    battery.js
  pages/
    Dashboard.jsx
    Landing.jsx
    HistoryAnalytics.jsx
```

## Future Implementation

- Replace frontend demo login with Firebase Authentication
- Add role-based access using Firestore user documents or Firebase custom claims
- Save Battery Entry records directly to Firestore
- Save generated Drone Profile sessions to Firestore and Realtime Database
- Connect the real drone/device upload pipeline to Firebase
- Add backend validation for incoming telemetry payloads
- Add battery/device registration linked to authenticated users
- Add real SOC, SOH, and RUL models
- Add anomaly detection for overheating, voltage sag, abnormal current spikes, and capacity degradation
- Add warning/critical notifications through email, dashboard alerts, or messaging
- Add filters, search, and date ranges in Traceability
- Add PDF report generation
- Store uploaded raw test files and generated reports in Firebase Storage
- Add automated tests for login flow, Firebase loading, dashboard rendering, traceability, and report export
- Add route-based navigation if the app grows beyond the current in-memory page switcher

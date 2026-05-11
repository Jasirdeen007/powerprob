# Battery Analytics Smoke Demo

React smoke implementation for the Cloud-Based Battery Test Analytics & Traceability Platform.

## Current Scope

- NASA battery dataset normalization
- Local demo data generated from `battery_dataset/cleaned_dataset`
- Dashboard with animated live readings
- Demo login controls for Technician, Engineer, and Manager
- Battery detail entry form
- Battery traceability timeline
- Rule-based compliance checks
- CSV/JSON report export
- Optional Firebase seed path

ML prediction, RUL modeling, TFT, and anomaly detection are intentionally left for the next iteration.

## Run Locally

```bash
npm install
npm run generate:data
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173/`.

## How The Data Runs

1. `scripts/generate-demo-data.js` reads `battery_dataset/cleaned_dataset/metadata.csv`.
2. It selects five NASA battery IDs: `B0047`, `B0048`, `B0045`, `B0046`, and `B0005`.
3. For each battery, it takes a limited number of charge/discharge sessions.
4. For every selected session, it opens the matching CSV file from `battery_dataset/cleaned_dataset/data`.
5. It samples readings from the CSV so the browser is not overloaded.
6. It writes normalized data to:
   - `public/demo-data.json`
   - `src/demo-data.json`
7. The React app imports `src/demo-data.json` as its fallback dataset.
8. The dashboard animates one selected session as if it is a live Firebase stream.

The generated structure contains:

- `batteries`: one summary record per battery
- `testSessions`: metadata, summary, and sampled readings for each test
- `liveReadings`: one simulated realtime stream
- `complianceRules`: fixed threshold rules for this iteration

## SOC And SOH Calculation

This iteration does not use ML.

SOC is estimated from voltage using a simple normalized voltage rule:

```txt
SOC = ((Voltage - 3.0) / 1.25) * 100
```

Then it is clamped between `0` and `100`.

So:

- `3.0V` is treated as roughly `0%`
- `4.25V` is treated as roughly `100%`
- Values outside this range are capped

This is only a demo approximation. In the next iteration, SOC should come from a better battery model or ML/service-side calculation.

SOH is estimated from capacity:

```txt
SOH = (Current Capacity / Initial Capacity) * 100
```

The first known capacity for that battery is treated as the initial capacity.

## Login Controls

The current login is a frontend smoke-demo role switch, not full Firebase Authentication yet.

Roles:

- `Technician`: Dashboard, Battery Entry, Dataset Seed, Traceability
- `Engineer`: Dashboard, Battery Entry, Dataset Seed, Traceability, Compliance, Reports
- `Manager`: Dashboard, Traceability, Compliance, Reports

When real Firebase Auth is added, these same roles should move into Firestore user documents or custom claims.

## Battery Entry

Use the `Battery Entry` page to add or update a battery record.

Fields:

- Battery ID
- Chemistry
- Manufacturer
- Test location
- Nominal capacity
- Initial status

For now, added batteries live in React state during the current browser session. The next Firebase step is to write these entries into the `batteries` Firestore collection.

## Firebase Seed

Copy `.env.example` to `.env`, fill the Firebase web app values, then run:

```bash
npm run firebase:seed
```

This writes:

- `batteries` collection
- `testSessions` collection
- `testReadings` collection
- `/liveReadings` in Realtime Database

Without Firebase config, the app uses bundled NASA-derived local demo data.

## Where To Paste Firebase Credentials

Create a file named `.env` in the project root beside `package.json`.

Paste your Firebase web app config like this:

```txt
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
```

After adding `.env`, restart the dev server.

The website checks these values automatically. If all values exist, it tries Firebase first. If Firebase fails or values are missing, it falls back to local NASA demo data.

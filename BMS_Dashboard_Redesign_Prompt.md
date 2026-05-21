# BMS POC Dashboard — Frontend Redesign Prompt
**Scope:** Frontend only — React UI rebuild on top of an existing, fully functional backend  
**Stack:** React (hooks) + Recharts + Firebase SDK  
**Project:** PowerProbeBMS — Real-time Battery Telemetry & Analytics Platform  
**Design Direction:** Precision Industrial Dark — High-contrast, data-dense, instrument-grade UI

> ⚠️ **IMPORTANT — READ BEFORE IMPLEMENTING**
> The backend is **already built and deployed**. Do NOT create, modify, or suggest changes to any backend code, API routes, database schemas, WebSocket logic, Firebase rules, or Firestore structure. Your job is exclusively to **replace and redesign the React frontend**, wiring it to the APIs and Firebase paths that already exist. All API contracts documented here reflect the real, live backend.

---

## 🎯 Project Context

This is a proof-of-concept Battery Management System (BMS) dashboard for drone battery testing.

### What already exists (do not touch)
| Layer | Technology | Status |
|---|---|---|
| Edge controller | Raspberry Pi + Python WebSocket client | ✅ Done |
| Embedded | STM32 PWM/ADC + MOSFET driver | ✅ Done |
| Backend API | FastAPI (REST + WebSocket manager) | ✅ Done |
| Live data store | Firebase RTDB | ✅ Done |
| Historical store | Firestore | ✅ Done |
| Auth | Firebase Auth | ✅ Done |

### What this prompt covers (frontend only)
The current React frontend **exists but is visually poor** — the layout, charts, KPI cards, and history analytics page all need a complete UI/UX overhaul. The goal is to replace every visual component while keeping **all API calls, Firebase listeners, and data contracts exactly as-is**.

### Data flow (for reference — do not change)
```
STM32 → Raspberry Pi → FastAPI WebSocket → Firebase RTDB → React (onValue listener)
                                         ↘ Firestore (historical packets)
```

### Key existing API contracts (frontend must conform to these)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/start-profile` | Start simulation with battery config + drone profile |
| POST | `/api/batteries` | Save a new custom battery entry |
| GET  | `/api/batteries` | Fetch user's saved custom batteries |
| Firebase RTDB | `live_sessions/{session_id}/latest_packet` | Live telemetry stream |
| Firestore | `telemetry_history/{session_id}/packet_documents` | Historical records |
| Firestore | `user_batteries/{userId}/batteries` | User-created battery profiles |

Below is the complete specification for every frontend section.

---

## 🌐 1. Entry / Landing Page — Floating Interface (Figma-style)

**Goal:** Replace the plain login/signup page with a cinematic floating-panel entry experience.

### Design Requirements
- Full-screen dark background with a **subtle animated mesh gradient** (deep navy `#0A0F1E`, dark slate `#0D1526`) — slow breathing pulse using CSS keyframes
- A **floating glassmorphism panel** centered on screen:
  - `backdrop-filter: blur(24px)`, `background: rgba(255,255,255,0.04)`, `border: 1px solid rgba(255,255,255,0.08)`
  - Soft drop shadow: `box-shadow: 0 32px 80px rgba(0,0,0,0.6)`
  - Panel should appear to float — give it a subtle `translateY` idle animation (±4px, 4s ease-in-out loop)
- **Logo/Brand** at the top: "PowerProbeBMS" in a monospaced or engineering-style font (e.g. `IBM Plex Mono`, `JetBrains Mono`, or `Space Mono`). Below it: `"Battery Intelligence Platform"` in muted text
- **Tab switcher** inside the panel: `Login` | `Sign Up` — smooth sliding underline indicator, no page reload
- Login form fields: Email, Password + "Forgot password?" link
- Sign Up form fields: Name, Email, Password, Confirm Password
- Submit button: Full-width, accent color `#00D4FF` or `#3BFFA0` (electric teal/green), with a glow on hover: `box-shadow: 0 0 20px rgba(0,212,255,0.4)`
- **Particle/grid overlay** (subtle): a faint dot-grid or scanline texture behind the panel, CSS only using `background-image: radial-gradient(...)` pattern
- Form validation with inline error states (red border + error text, no alert popups)
- On successful login: animate panel out with `scale(0.95) opacity(0)` → route to Dashboard

---

## 📊 2. Dashboard Page — Live Battery Telemetry

### 2A. Layout Architecture

Use a **3-zone layout**:
```
┌─────────────────────────────────────────────────────┐
│  Top Nav Bar                                        │
├────────────────┬────────────────────────────────────┤
│  Left Panel    │  Main Content Area                 │
│  (Config +     │  (KPI Cards + Charts)              │
│   Controls)    │                                    │
└────────────────┴────────────────────────────────────┘
```

### 2B. Top Navigation Bar

- Dark bar: `background: #080D1A`, `border-bottom: 1px solid rgba(255,255,255,0.06)`
- Left: Logo + project name
- Center: **Live status indicator** — a pulsing green dot (`animation: pulse 1.5s infinite`) + text `"LIVE TELEMETRY"` when simulation is running, grey `"STANDBY"` when idle
- Right: Session timer (elapsed time since Run was clicked), notification bell icon, user avatar/initials, logout

### 2C. Left Config Panel (collapsible, ~280px wide)

**Layer 1: Battery Specs**  
Clean form card with:
- `Battery Type` — styled segmented control (not a plain `<select>`): buttons for `Li-ion | LiPo | LiFePO4 | Solid-State` plus any user-created custom batteries, active state highlighted with accent border + background tint
- `C Rating` — number input with +/- stepper buttons
- `Capacity (mAh)` — number input
- `No. of Cells` — number input with auto-calculated voltage preview shown inline: `→ 14.8V nominal`
- `Voltage` — auto-filled but editable
- Live summary chip below: `10C · Li-ion · 4500mAh · 4S · 14.8V` — updates dynamically as user types

**Custom Battery Entry (NEW FEATURE):**
- Below the Battery Type selector, add a `+ Add New Battery` button (small, muted, with a `+` icon)
- Clicking it opens a compact slide-up modal with fields:
  - `Battery Name / ID` (e.g. "B0051", "Pack-Alpha") — text input
  - `Chemistry` — segmented control: `Li-ion | LiPo | LiFePO4 | Solid-State`
  - `Capacity (mAh)` — number input
  - `Nominal Voltage (V)` — number input
  - `Max C Rating` — number input
  - `Notes` — optional short text
  - `Save Battery` (accent button) · `Cancel` (ghost button)
- On save: POST the new battery to the backend (`POST /api/batteries`) and store in Firestore under `user_batteries/{userId}/batteries`
- The new battery **immediately appears** in the Battery Type selector — optimistic UI update, no page reload
- User-created batteries are visually distinguished with a small `CUSTOM` pill tag next to their name in the selector
- Batteries persist across sessions, scoped per authenticated user (loaded on login via `GET /api/batteries`)
- Allow deleting custom batteries via a trash icon that appears on hover within the selector list (with a confirmation prompt)
- The History Analytics Battery ID filter dropdown must also reflect user-created batteries dynamically

**Layer 2: Drone Profile**  
- Dropdown styled as a card-selector (show drone name + icon/emoji + brief description per option):
  - 🔍 Surveillance Drone
  - 📦 Delivery Heavy Lift
  - 🏎️ FPV Racing Drone
  - 🔬 Inspection Quad
- On selection, show a small mission profile preview (e.g., phase labels: Takeoff → Cruise → Hover → Return)

**Run Controls**  
- Three buttons in a row: `▶ Run` (green) · `⏸ Pause` (amber) · `⏹ Stop` (red)
- Disable Pause/Stop when not running; disable Run when already running
- Show a mini progress bar below showing simulation progress percentage

### 2D. KPI Instrument Panel (Top of main content area)

Replace the current plain stat grid with **5 glowing instrument cards** in a responsive grid (3 columns on desktop, 2 on tablet):

> **Removed features:** The "Search Telemetry" input field is fully removed. Do not implement any text-based search within the live telemetry/instrument panel.

Each card:
- Dark glass card: `background: rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.07)`
- Metric icon (SVG or Lucide icon) in accent color
- Large numeric value in monospaced font with unit suffix
- Status badge (color-coded): `NOMINAL` (green) / `WARNING` (amber) / `CRITICAL` (red)
- Subtle animated border glow when value is updating (flash `rgba(0,212,255,0.3)` briefly on each new value)

The 5 KPI cards:
1. ⚡ **Voltage** — `00.00 V` · active bus
2. 〰️ **Current** — `00.00 A` · realtime draw
3. 🌡️ **Temperature** — `00.0 °C` · thermal state
4. 🔋 **SOC** — `100%` with a thin arc gauge beneath the number
5. 💚 **SOH** — `99.5%` with a thin arc gauge

> **Removed:** Power and Internal Resistance have been removed from the KPI card strip per product decision. Power is still charted in the chart section below.

**User-Selectable KPI Spotlight (NEW FEATURE):**
- Below the 5 KPI cards, show a **"Spotlight Panel"** with a prompt: `"Pin up to 3 metrics for enlarged monitoring"`
- The user can click any of the 5 KPI cards to toggle them into the Spotlight
- Pinned metrics appear as large-format cards (3x size) in the Spotlight zone with bigger fonts and more visual weight
- Persist selection in `localStorage` per user

### 2E. Real-Time Charts Section

**"View All Charts" Button (NEW FEATURE):**
- A prominent button: `📊 View All Metrics` or `Expand All Charts`
- Clicking it opens a **full-screen overlay** (`position: fixed, inset: 0, z-index: 999`) with all 6 charts displayed in a 2-column grid layout, all updating live simultaneously
- An `✕ Close` button exits the overlay
- The overlay should have the same dark glassmorphism aesthetic

**Default Chart View (below KPI cards):**
Display charts in a 2-column responsive grid. Each chart:
- Dark card container with chart title, live value badge (top right), and timeframe selector tabs (`1m | 5m | 15m | All`)
- Use **Recharts `AreaChart`** with gradient fills — accent color at the top fading to transparent at the bottom
- X-axis: time in `MM:SS` format, only show last N seconds of data (rolling window)
- Smooth `isAnimationActive={false}` for performance on live data (or use `animationDuration={100}`)
- Show a **"NO DATA"** placeholder state with a dashed border and icon when simulation hasn't started

The 6 charts (**Internal Resistance removed**):
1. **Voltage Trend (V)** — accent: `#00D4FF`
2. **Current Load (A)** — accent: `#3BFFA0`
3. **Thermal Profile (°C)** — accent: `#FF6B35`
4. **State of Charge (%)** — accent: `#A78BFA`
5. **State of Health (%)** — accent: `#34D399`
6. **Power Consumption (W)** — accent: `#FBBF24`

**Y-Axis Zero-Baseline Rule:**
All charts where the metric can logically start at 0 must have `domain={[0, 'auto']}` set on the Recharts `<YAxis>`. This applies to: Current, SOC, SOH, Power. For Voltage and Temperature, use `domain={['auto', 'auto']}` since a battery at rest may sit at a non-zero resting voltage/temperature — but the axis must still never show negative values (`domain={[0, 'auto']}` is acceptable for these too unless values are expected above a known floor). Never let Recharts auto-scale to a mid-range value that makes small changes look dramatic.

---

## 📁 3. History Analytics Page — Complete Redesign

**Current state:** Plain filter panel + raw records table. Needs to become a full analytics workspace.

### 3A. Page Header
- Page title: `"Session History"` with subtitle: `"Inspect, compare, and export battery telemetry across all recorded sessions"`
- Summary chips in the header row: `Total Records: 4,446` · `Visible: 895` · `Sessions: 23` — styled as pill badges

### 3B. Filter Panel (Collapsible sidebar or top filter bar)

Make filters visually polished:
- **Battery ID selector** — searchable dropdown with battery labels (B0047, etc.)
- **Date Range** — pill button group: `24h | 7d | 30d | Custom` — clicking `Custom` reveals a date picker inline
- **Mode filter** — three toggle chips: `CHARGE` (blue) · `DISCHARGE` (red) · `IDLE` (grey) — multi-select, active state uses filled background
- **Reset Filters** button — muted, only appears when filters are active
- Filter state summary: `"Showing 895 of 4,446 records · Battery B0047 · Last 7 days · DISCHARGE mode"` — shown as a live-updating sentence below the filter controls

### 3C. Visualization Panel (NEW — behind "Show Visualization" button)

When user clicks `Show Visualization`, reveal a rich analytics section above the table:

**Chart 1 — Voltage/Current/Temperature over Time (Multi-line)**
- Recharts `LineChart` with 3 togglable series
- Legend with colored checkboxes to show/hide each series
- Zoom & pan via `<Brush>` component at the bottom

**Chart 2 — SOH Degradation Trend**
- Area chart showing SOH % across sessions over time
- Mark sessions where SOH dropped significantly with a dot annotation

**Chart 3 — Session Summary Bar Chart**
- Each bar = one session
- Bar height = energy discharged (Wh)
- Color-coded by mode (charge/discharge/idle)
- Hover tooltip shows session ID, duration, start/end SOC, avg temperature

**Chart 4 — Distribution Histogram**
- Show distribution of a selected metric (user picks from dropdown: Voltage / Current / Temp)
- Recharts `BarChart` acting as histogram with 20 bins

Layout: 2-column grid on desktop (Charts 1+2 top row, Charts 3+4 bottom row)

### 3D. Data Table (Filtered Historical Records)

Replace raw table with a professional data table:
- **Sticky header** with sort indicators on each column (click to sort ASC/DESC)
- **Row hover highlight**: subtle `rgba(255,255,255,0.03)` background
- **Color-coded Mode column**: `CHARGE` = blue badge · `DISCHARGE` = red badge · `IDLE` = grey badge
- **Voltage/Current/Temp columns**: show a tiny inline sparkline bar (colored bar scaled to value range) alongside the number
- **Pagination**: `← Previous | Page 1 of 12 | Next →` with page size selector `25 | 50 | 100`
- **Column visibility toggle**: a `Columns ▾` button lets the user show/hide columns
- **Row expand**: clicking a row expands an inline detail panel showing that packet's full telemetry snapshot

### 3E. Export Controls

- `Export CSV` button — exports currently filtered dataset
- `Export PNG` button — exports visible charts as PNG (use `html2canvas` or `recharts` `toDataURL`)
- Export scope label: `"Exporting filtered dataset (895 records)"`

---

## 🧭 4. Navigation / Sidebar

Replace the current nav with a **left sidebar** (collapsible to icon-only mode):
- Logo at top
- Navigation items with icons:
  - 📊 Dashboard
  - 📁 History Analytics
  - ⚙️ Settings *(placeholder)*
  - ❓ Help *(placeholder)*
- Collapse button at bottom (arrow icon toggles width between `240px` and `64px`)
- Active route highlighted with accent left border + background tint
- User section at the very bottom: avatar, name, email, logout button

---

## 🎨 5. Design System Tokens

Apply these CSS variables globally:

```css
:root {
  /* Backgrounds */
  --bg-primary:    #080D1A;
  --bg-surface:    #0D1526;
  --bg-elevated:   #111B30;
  --bg-glass:      rgba(255,255,255,0.04);

  /* Borders */
  --border-subtle: rgba(255,255,255,0.06);
  --border-medium: rgba(255,255,255,0.10);

  /* Accent Colors */
  --accent-cyan:   #00D4FF;
  --accent-green:  #3BFFA0;
  --accent-amber:  #FBBF24;
  --accent-red:    #F87171;
  --accent-purple: #A78BFA;

  /* Text */
  --text-primary:  #F0F4FF;
  --text-secondary:#8B9EC7;
  --text-muted:    #4A5878;

  /* Status */
  --status-live:   #3BFFA0;
  --status-warn:   #FBBF24;
  --status-error:  #F87171;
  --status-idle:   #4A5878;

  /* Typography */
  --font-ui:    'IBM Plex Sans', sans-serif;       /* All UI labels, body */
  --font-mono:  'IBM Plex Mono', monospace;        /* All numeric values, codes */
  --font-brand: 'Space Mono', monospace;           /* Logo, headings */
}
```

---

## ⚙️ 6. Frontend Implementation Notes

> All notes below are **React-only**. Do not create or modify backend files.

### Connecting to the Existing Backend
- The FastAPI base URL is already configured in the existing codebase — reuse it (typically via an env variable `REACT_APP_API_URL` or `VITE_API_URL`)
- Firebase is already initialised in `firebase.js` / `firebaseConfig.js` — import and reuse, do not reinitialise
- Auth state is managed via Firebase Auth — use the existing `onAuthStateChanged` listener; do not rebuild auth logic

### Real-Time Data Flow (existing — just consume it correctly)
- Subscribe to Firebase RTDB with `onValue()` at path `live_sessions/{session_id}/latest_packet`
- On each new packet, push data point to a rolling array (max 300 points, `useRef` for performance)
- Trigger chart re-render using `useState` with a throttle of ~100ms using `setInterval` or `lodash.throttle`
- Use `useCallback` and `useMemo` to avoid unnecessary re-renders in chart components

### Chart Performance
- Keep chart data in a `useRef` rolling buffer, only call `setState` on a throttled interval
- Use `isAnimationActive={false}` on all Recharts components for live data
- For the "View All Charts" overlay, render charts lazily only when the overlay opens

### KPI Spotlight Feature
- Use a `useState` array of up to 3 selected metric keys
- Persist in `localStorage` with key `bms_spotlight_metrics`
- Animate card into spotlight zone using CSS transition on height/size

### History Analytics State
- Use `useMemo` to compute filtered records from the full dataset
- Debounce filter inputs by 300ms before applying
- Virtualize the data table using `react-window` or `react-virtual` for 4000+ rows

---

## ✅ Deliverables Checklist

- [ ] Entry page with floating glassmorphism login/signup panel
- [ ] Animated mesh gradient background
- [ ] Dashboard 3-zone layout (sidebar + main)
- [ ] Battery spec config panel with segmented controls
- [ ] Drone profile card-selector
- [ ] 5 animated KPI instrument cards (Voltage, Current, Temperature, SOC, SOH)
- [ ] User-selectable KPI Spotlight (pin up to 3)
- [ ] 6 real-time area/line charts with rolling window (Internal Resistance removed)
- [ ] Custom battery entry modal with Firestore persistence
- [ ] Battery selector reflects user-created batteries dynamically
- [ ] All applicable chart Y-axes start at 0 (`domain={[0, 'auto']}`)
- [ ] Search Telemetry field removed entirely
- [ ] "View All Charts" full-screen overlay
- [ ] Left collapsible sidebar navigation
- [ ] History Analytics filter panel (pill buttons + searchable dropdown)
- [ ] History Analytics 4-chart visualization section
- [ ] Professional sortable data table with inline sparklines
- [ ] Row-expand detail panel
- [ ] CSV + PNG export
- [ ] Global CSS design token system
- [ ] Responsive layout (desktop-first, tablet-friendly)

---

## 💡 My Suggestions for Your Team

### 1. Separate Chart Config from Business Logic
Create a `chartConfig.js` file that defines each metric's color, label, unit, and data key. This makes adding/removing metrics trivial without touching chart components. Keep **Internal Resistance excluded** from this config — do not add it back.

### 0. Custom Battery State Architecture
For the custom battery entry feature, use a `useBatteries()` hook:
```js
// Returns { batteries, addBattery, deleteBattery, isLoading }
// Fetches from GET /api/batteries on mount
// Optimistically updates local state on POST /api/batteries
// Zustand store key: 'userBatteries'
```
The Battery Type selector and the History Analytics Battery ID filter must both subscribe to the same `userBatteries` store slice so they stay in sync without extra API calls.

### 2. Use a WebSocket Hook
Wrap your Firebase `onValue` subscription in a custom `useTelemetry()` hook that returns `{ latest, isLive, sessionId }`. This keeps all real-time logic in one place and makes components clean.

### 3. Consider Zustand for Global State
Instead of prop-drilling telemetry data through multiple levels, use **Zustand** (already in your recommended stack). Store: `batteryConfig`, `sessionState`, `telemetryBuffer`, `spotlightMetrics`.

### 4. Rolling Buffer Pattern for Charts
```js
const bufferRef = useRef([]);
const MAX_POINTS = 300;

// In your Firebase onValue handler:
bufferRef.current = [...bufferRef.current.slice(-MAX_POINTS + 1), newDataPoint];
```
Only trigger `setState` on a 100ms interval, not on every packet. This keeps charts smooth at high telemetry rates.

### 5. Progressive Enhancement for History Charts
Don't load all 4,446 history records at once. Use Firestore pagination (`limit(100)`, `startAfter(lastDoc)`) and load more as the user scrolls down or clicks "Load More". The visualization charts can work on the currently loaded page.

### 6. Color-Blind Accessible Status Indicators
Since this is a monitoring/safety tool, don't rely on color alone. Add:
- Shape differentiation (✓ circle for OK, ⚠ triangle for warning, ✕ octagon for error)
- Pattern fills on charts (dashed lines for secondary series)

### 7. Keyboard Shortcuts Panel
For power users doing repeated battery tests, add a `?` shortcut that shows a keyboard shortcuts overlay: `R` = Run, `P` = Pause, `S` = Stop, `H` = History, `E` = Export. Very small effort, very professional feel.

---

*This prompt was generated based on the BMS Backend Architecture Documentation and current feature inventory provided by the product team.*

**Scope reminder:** This is a **frontend-only** redesign. The backend (FastAPI, Raspberry Pi, STM32, Firebase RTDB, Firestore, Firebase Auth) is complete and must not be altered. Every API endpoint, Firebase path, and data schema listed in this document is the live, authoritative contract the new frontend must conform to.

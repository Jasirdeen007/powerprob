# BMS Real-Time Output Metrics

These are the actual values a BMS outputs live — what gets logged, displayed, or sent to a dashboard.

---

## Voltage

| Metric | Unit | Example Value |
|--------|------|---------------|
| Cell voltage (per cell) | V | 3.85 V |
| Pack voltage | V | 396.2 V |
| Min cell voltage | V | 3.79 V |
| Max cell voltage | V | 3.87 V |
| Cell delta voltage | mV | 80 mV |

---

## Current

| Metric | Unit | Example Value |
|--------|------|---------------|
| Discharge current | A | 142 A |
| Charge current | A | 48 A |
| Peak current (burst) | A | 320 A |

---

## Temperature

| Metric | Unit | Example Value |
|--------|------|---------------|
| Cell temperature (per sensor) | °C | 38°C |
| Max cell temperature | °C | 44°C |
| Min cell temperature | °C | 31°C |
| Pack temperature | °C | 41°C |

---

## State Estimates

| Metric | Unit | Example Value |
|--------|------|---------------|
| State of Charge (SoC) | % | 72% |
| State of Health (SoH) | % | 91% |
| Internal resistance (IR) | mΩ | 12 mΩ |
| Remaining capacity | Ah | 58.4 Ah |
| Energy consumed | Wh | 3240 Wh |
| Cycle count | — | 214 |

---

## Fault / Status Flags

| Flag | Values |
|------|--------|
| Overvoltage | 0 / 1 |
| Undervoltage | 0 / 1 |
| Overcurrent | 0 / 1 |
| Overtemperature | 0 / 1 |
| Cell imbalance alert | 0 / 1 |
| Contactor / relay state | Open / Closed |
| Charging state | Idle / Charging / Discharging |

---

## Vehicle-Specific Extras

| Vehicle | Extra Output |
|---------|--------------|
| EV | Regen braking limit (A), Charge power limit (W) |
| Drone | Flight time remaining (min), RTH triggered (0/1) |
| FC Car | AIR contactor state, IMD insulation resistance (kΩ), Energy per lap (Wh) |

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from models.telemetry import DerivedMetrics, EnrichedTelemetryPacket, TelemetryPacket
from services.sessions import get_session_capacity_ah


SOH_EOL_PERCENT = 80.0
DESIGN_CYCLE_LIFE = 500
DEFAULT_CAPACITY_AH = 2.2


@dataclass
class SessionMetricState:
    previous_packet: TelemetryPacket | None = None
    soc: float = 100.0
    measured_capacity_ah: float | None = None
    completed_cycles: int = 0
    cycle_discharge_ah: float = 0.0


session_states: dict[str, SessionMetricState] = {}


def build_alerts(packet: TelemetryPacket) -> list[str]:
    alerts = []
    cells = [
        packet.cell_voltage.cell1,
        packet.cell_voltage.cell2,
        packet.cell_voltage.cell3,
    ]
    cell_delta = max(cells) - min(cells)

    if packet.temperature.battery >= 45:
        alerts.append("BATTERY_OVERTEMP")
    elif packet.temperature.battery >= 38:
        alerts.append("BATTERY_TEMP_WARNING")
    if packet.temperature.mosfet >= 70:
        alerts.append("MOSFET_OVERTEMP")
    if cell_delta >= 0.08:
        alerts.append("CELL_IMBALANCE")
    if packet.pack_voltage <= 9.6:
        alerts.append("LOW_PACK_VOLTAGE")
    if packet.event:
        alerts.append(packet.event)

    return alerts


def seconds_between(current: datetime, previous: datetime | None) -> float:
    if not previous:
        return 0.0
    return max(0.0, (current - previous).total_seconds())


def estimate_soc(previous_soc: float, current_a: float, dt_s: float, capacity_ah: float) -> float:
    if capacity_ah <= 0 or dt_s <= 0:
        return previous_soc

    soc = previous_soc - ((current_a * dt_s) / (3600 * capacity_ah)) * 100
    return max(0.0, min(100.0, soc))


def estimate_soh(state: SessionMetricState, cycle_capacity_ah: float, rated_capacity_ah: float) -> float:
    if rated_capacity_ah <= 0:
        return 100.0

    previous_measured = state.measured_capacity_ah or rated_capacity_ah
    if cycle_capacity_ah > 0:
        state.measured_capacity_ah = (0.2 * cycle_capacity_ah) + (0.8 * previous_measured)
    else:
        state.measured_capacity_ah = previous_measured

    return max(0.0, min(100.0, (state.measured_capacity_ah / rated_capacity_ah) * 100))


def estimate_rul(soh: float, completed_cycles: int) -> float:
    if soh <= SOH_EOL_PERCENT:
        return 0.0

    soh_drop = max(0.0, 100.0 - soh)
    if completed_cycles >= 5 and soh_drop > 0:
        degradation_per_cycle = soh_drop / completed_cycles
    else:
        degradation_per_cycle = (100.0 - SOH_EOL_PERCENT) / DESIGN_CYCLE_LIFE

    return max(0.0, (soh - SOH_EOL_PERCENT) / degradation_per_cycle)


def enrich_packet(packet: TelemetryPacket) -> EnrichedTelemetryPacket:
    state = session_states.setdefault(packet.session_id, SessionMetricState())
    rated_capacity_ah = get_session_capacity_ah(packet.session_id) or DEFAULT_CAPACITY_AH
    dt_s = seconds_between(packet.timestamp, state.previous_packet.timestamp if state.previous_packet else None)

    state.soc = estimate_soc(state.soc, packet.current, dt_s, rated_capacity_ah)
    if packet.current > 0 and dt_s > 0:
        state.cycle_discharge_ah += (packet.current * dt_s) / 3600

    if state.previous_packet and state.previous_packet.mode != packet.mode and packet.mode.upper() == "DISCHARGE":
        state.completed_cycles += 1

    soh = estimate_soh(state, state.cycle_discharge_ah, rated_capacity_ah)
    rul = estimate_rul(soh, state.completed_cycles)
    state.previous_packet = packet

    return EnrichedTelemetryPacket(
        **packet.model_dump(),
        derived=DerivedMetrics(
            soc=round(state.soc, 1),
            soh=round(soh, 1),
            rul=round(rul, 1),
        ),
        alerts=build_alerts(packet),
    )

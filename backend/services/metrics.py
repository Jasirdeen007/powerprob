from models.telemetry import DerivedMetrics, EnrichedTelemetryPacket, TelemetryPacket

previous_packets: dict[str, TelemetryPacket] = {}


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
    if packet.temperature.mosfet >= 70:
        alerts.append("MOSFET_OVERTEMP")
    if cell_delta >= 0.08:
        alerts.append("CELL_IMBALANCE")
    if packet.pack_voltage <= 9.6:
        alerts.append("LOW_PACK_VOLTAGE")
    if packet.event:
        alerts.append(packet.event)

    return alerts


def estimate_soc(packet: TelemetryPacket) -> float:
    per_cell_voltage = packet.pack_voltage / 3
    soc = ((per_cell_voltage - 3.0) / 1.2) * 100
    return round(max(0, min(100, soc)), 1)


def estimate_ir(packet: TelemetryPacket) -> float | None:
    previous = previous_packets.get(packet.session_id)
    if not previous:
        return None

    delta_current = abs(packet.current - previous.current)
    if delta_current < 0.1:
        return None

    delta_voltage = abs(packet.pack_voltage - previous.pack_voltage)
    return round(delta_voltage / delta_current, 4)


def enrich_packet(packet: TelemetryPacket) -> EnrichedTelemetryPacket:
    soc = estimate_soc(packet)
    ir = estimate_ir(packet)
    thermal_penalty = max(0, packet.temperature.battery - 35) * 0.15
    soh = round(max(70, min(100, 100 - thermal_penalty)), 1)
    rul = round(max(0, (soh - 70) * 10), 1)
    previous_packets[packet.session_id] = packet

    return EnrichedTelemetryPacket(
        **packet.model_dump(),
        derived=DerivedMetrics(soc=soc, soh=soh, rul=rul, ir=ir),
        alerts=build_alerts(packet),
    )

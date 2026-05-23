from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CellVoltage(BaseModel):
    cell1: float
    cell2: float
    cell3: float


class Temperature(BaseModel):
    battery: float
    mosfet: float
    ambient: float


class DerivedMetrics(BaseModel):
    soc: float
    soh: float
    rul: float


class TelemetryPacket(BaseModel):
    session_id: str = Field(..., min_length=1)
    timestamp: datetime
    mode: str
    profile: str
    pack_voltage: float
    cell_voltage: CellVoltage
    current: float
    temperature: Temperature
    event: str = ""


class EnrichedTelemetryPacket(TelemetryPacket):
    derived: DerivedMetrics
    alerts: list[str] = []


class WebSocketMessage(BaseModel):
    type: Literal["telemetry", "status", "ack"]
    payload: dict = {}

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class CellVoltage(BaseModel):
    cell1: float | None = None
    cell2: float | None = None
    cell3: float | None = None


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
    battery_id: str | None = None
    battery_name: str | None = None
    timestamp: datetime
    mode: str
    pack_voltage: float | None = None
    cell_voltage: CellVoltage | None = None
    current: float | None = None
    temperature: Temperature
    event: str = ""

    @model_validator(mode="after")
    def require_real_temperature(self):
        if self.temperature is None:
            raise ValueError("temperature is required")
        return self


class EnrichedTelemetryPacket(TelemetryPacket):
    derived: DerivedMetrics | None = None
    alerts: list[str] = []


class WebSocketMessage(BaseModel):
    type: Literal["telemetry", "status", "ack"]
    payload: dict = {}

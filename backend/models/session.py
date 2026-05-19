from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


DroneType = Literal[
    "AGRI",
    "SURVEILLANCE",
    "FPV",
    "Surveillance Drone",
    "Delivery Heavy Lift",
    "FPV Racing Drone",
    "Inspection Quad",
]


class BatteryConfig(BaseModel):
    chemistry: str
    cell_count: int = Field(..., gt=0)
    capacity_ah: float = Field(..., gt=0)
    drone_type: DroneType
    discharge_profile: str


class SessionStartRequest(BaseModel):
    battery_id: str = Field(..., min_length=1)
    config: BatteryConfig


class SessionStartResponse(BaseModel):
    session_id: str
    status: str
    command_sent: bool
    command: dict


class SessionEndRequest(BaseModel):
    session_id: str


class SessionRecord(BaseModel):
    session_id: str
    battery_id: str
    config: BatteryConfig
    status: str
    started_at: datetime
    ended_at: datetime | None = None

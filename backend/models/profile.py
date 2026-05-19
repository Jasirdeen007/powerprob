from pydantic import BaseModel, Field


class DroneProfile(BaseModel):
    id: str
    name: str
    description: str
    command: dict = Field(default_factory=dict)

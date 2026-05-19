from pydantic import BaseModel


class DroneProfile(BaseModel):
    id: str
    name: str
    description: str
    command: dict = {}

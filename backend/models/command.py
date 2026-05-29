from pydantic import BaseModel, Field


class CommandPayload(BaseModel):
    type: str = "START_PROFILE"
    session_id: str
    device_id: str | None = None
    command: dict = Field(default_factory=dict)

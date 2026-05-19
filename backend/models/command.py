from pydantic import BaseModel, Field


class CommandPayload(BaseModel):
    type: str = "START_PROFILE"
    session_id: str
    command: dict = Field(default_factory=dict)

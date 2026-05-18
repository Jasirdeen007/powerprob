from pydantic import BaseModel


class CommandPayload(BaseModel):
    type: str = "START_PROFILE"
    session_id: str
    command: dict = {}

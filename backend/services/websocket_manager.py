from __future__ import annotations

import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class PiWebSocketManager:
    def __init__(self):
        self.connection: WebSocket | None = None
        self.active_session_id: str | None = None
        self.active_profile: str | None = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connection = websocket
        logger.info("Pi WebSocket connected")

    def disconnect(self, websocket: WebSocket):
        if self.connection is websocket:
            self.connection = None
            logger.info("Pi WebSocket disconnected")

    async def send_command(self, command: dict) -> bool:
        if not self.connection:
            logger.info("No Pi WebSocket connected; command was not sent")
            return False

        await self.connection.send_json(command)
        logger.info("Command sent to Pi for session %s", command.get("session_id"))
        return True

    def set_active_session(self, session_id: str, profile: str) -> None:
        self.active_session_id = session_id
        self.active_profile = profile

    def clear_active_session(self, session_id: str) -> None:
        if self.active_session_id == session_id:
            self.active_session_id = None
            self.active_profile = None


pi_ws_manager = PiWebSocketManager()

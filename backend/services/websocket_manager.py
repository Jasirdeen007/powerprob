from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class PiWebSocketManager:
    def __init__(self):
        self.connection: WebSocket | None = None
        self.active_session_id: str | None = None
        self.active_profile: str | None = None
        self.connected_at: datetime | None = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connection = websocket
        self.connected_at = datetime.now(UTC)
        logger.info("Pi WebSocket connected")

    def disconnect(self, websocket: WebSocket):
        if self.connection is websocket:
            self.connection = None
            self.connected_at = None
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

    def status(self) -> dict:
        return {
            "connected": self.connection is not None,
            "transport": "websocket",
            "endpoint": "/ws/pi",
            "connected_at": self.connected_at.isoformat() if self.connected_at else None,
            "active_session_id": self.active_session_id,
            "active_profile": self.active_profile,
        }


pi_ws_manager = PiWebSocketManager()

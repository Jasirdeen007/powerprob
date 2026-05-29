import os
from pathlib import Path

from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_PATH, override=True)


class Settings:
    firebase_service_account_path: str | None = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    firebase_database_url: str | None = os.getenv("FIREBASE_DATABASE_URL")
    mqtt_host: str = os.getenv("MQTT_HOST", "127.0.0.1")
    mqtt_port: int = int(os.getenv("MQTT_PORT", "1883"))
    mqtt_username: str | None = os.getenv("MQTT_USERNAME")
    mqtt_password: str | None = os.getenv("MQTT_PASSWORD")
    mqtt_client_id: str = os.getenv("MQTT_CLIENT_ID", "powerprobe-backend")
    mqtt_default_device_id: str = os.getenv("MQTT_DEFAULT_DEVICE_ID", "pi-001")
    mqtt_topic_prefix: str = os.getenv("MQTT_TOPIC_PREFIX", "powerprobe/team6").strip("/")
    mqtt_heartbeat_stale_seconds: int = int(os.getenv("MQTT_HEARTBEAT_STALE_SECONDS", "45"))
    mqtt_prefer_ipv4: bool = os.getenv("MQTT_PREFER_IPV4", "false").strip().lower() in {"1", "true", "yes", "on"}
    allow_origins: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "BACKEND_ALLOW_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if origin.strip()
    ]
    allow_origin_regex: str | None = os.getenv(
        "BACKEND_ALLOW_ORIGIN_REGEX",
        r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+):5173",
    )


settings = Settings()

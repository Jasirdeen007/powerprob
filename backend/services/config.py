import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    firebase_service_account_path: str | None = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    firebase_database_url: str | None = os.getenv("FIREBASE_DATABASE_URL")
    allow_origins: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "BACKEND_ALLOW_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if origin.strip()
    ]


settings = Settings()

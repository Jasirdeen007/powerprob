import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logging():
    # Keep the application log outside the directory watched by uvicorn
    # --reload. Writing backend/logs/backend.log causes the reloader to
    # restart continuously while the application is serving requests.
    log_dir = Path(__file__).resolve().parents[2] / "logs"
    log_dir.mkdir(exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    file_handler = RotatingFileHandler(
        log_dir / "backend.log",
        maxBytes=1_000_000,
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers.clear()
    root.addHandler(file_handler)
    root.addHandler(stream_handler)

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import Any


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "drone_control_profile.csv"


PROFILE_DEFINITIONS = [
    {
        "id": "surveillance-drone",
        "name": "Surveillance Drone",
        "description": "Hover, camera sweep, return, and controlled landing.",
        "aliases": {"SURVEILLANCE", "Surveillance Drone"},
    },
    {
        "id": "delivery-heavy-lift",
        "name": "Delivery Heavy Lift",
        "description": "Payload attachment, high-draw transit, drop-off, and return.",
        "aliases": {"AGRI", "Delivery Heavy Lift"},
    },
    {
        "id": "fpv-racing-drone",
        "name": "FPV Racing Drone",
        "description": "High-speed gates, maximum output draw, loops, and thermal challenge.",
        "aliases": {"FPV", "FPV Racing Drone"},
    },
    {
        "id": "inspection-quad",
        "name": "Inspection Quad",
        "description": "Structural check, steady grid path, high-wind holds, and precision landing.",
        "aliases": {"Inspection Quad"},
    },
]


@lru_cache
def load_control_points() -> list[dict[str, int | float]]:
    points: list[dict[str, int | float]] = []
    with DATA_PATH.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            points.append(
                {
                    "timestamp_s": int(float(row["timestamp_s"])),
                    "vref_V": float(row["vref_V"]),
                }
            )
    return points


def normalize_profile_key(value: str) -> str:
    normalized = value.strip().casefold()
    for profile in PROFILE_DEFINITIONS:
        names = {profile["id"], profile["name"], *profile["aliases"]}
        if normalized in {name.casefold() for name in names}:
            return profile["id"]
    return "surveillance-drone"


def build_profile_command(profile_value: str) -> dict[str, Any]:
    profile_id = normalize_profile_key(profile_value)
    profile = next(item for item in PROFILE_DEFINITIONS if item["id"] == profile_id)
    control_points = load_control_points()
    return {
        "profile_id": profile["id"],
        "profile_name": profile["name"],
        "source_file": DATA_PATH.name,
        "sample_count": len(control_points),
        "columns": ["timestamp_s", "vref_V"],
        "control_points": control_points,
    }


def list_profiles() -> list[dict[str, Any]]:
    command = build_profile_command("Surveillance Drone")
    summary = {
        "source_file": command["source_file"],
        "sample_count": command["sample_count"],
        "columns": command["columns"],
    }
    return [
        {
            "id": profile["id"],
            "name": profile["name"],
            "description": profile["description"],
            "command": summary,
        }
        for profile in PROFILE_DEFINITIONS
    ]

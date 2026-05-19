import json
import os
import urllib.error
import urllib.request


BASE_URL = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000")


def request(method, path, payload=None):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        return error.code, {}


def test_health_ok():
    status, body = request("GET", "/health")
    assert status == 200
    assert body["status"] == "ok"


def test_profiles_ok():
    status, body = request("GET", "/profiles")
    assert status == 200
    assert len(body["profiles"]) == 3


def test_session_start_valid_and_invalid():
    valid = {
        "battery_id": "B0047",
        "config": {
            "chemistry": "Li-ion",
            "cell_count": 3,
            "capacity_ah": 2.2,
            "drone_type": "SURVEILLANCE",
            "discharge_profile": "PULSE",
        },
    }
    status, body = request("POST", "/session/start", valid)
    assert status == 200
    assert body["session_id"].startswith("SESSION_")

    status, _ = request("POST", "/session/start", {"battery_id": ""})
    assert 400 <= status < 500


def test_session_end_valid_and_invalid():
    status, body = request("POST", "/session/end", {"session_id": "SESSION_TEST"})
    assert status == 200
    assert body["status"] == "completed"

    status, _ = request("POST", "/session/end", {})
    assert 400 <= status < 500


def test_sessions_ok():
    status, body = request("GET", "/sessions")
    assert status == 200
    assert "sessions" in body


def test_historical_valid_and_invalid():
    status, body = request("GET", "/historical?session_id=SESSION_TEST")
    assert status == 200
    assert "packets" in body

    status, _ = request("GET", "/historical")
    assert 400 <= status < 500


def test_telemetry_valid_and_invalid():
    valid = {
        "session_id": "SESSION_TEST_B0047",
        "timestamp": "2026-05-18T10:15:32",
        "mode": "DISCHARGE",
        "profile": "PULSE",
        "pack_voltage": 11.84,
        "cell_voltage": {"cell1": 3.96, "cell2": 3.94, "cell3": 3.94},
        "current": 8.42,
        "temperature": {"battery": 34.2, "mosfet": 46.8, "ambient": 29.1},
        "event": "LOAD_SPIKE",
    }
    status, body = request("POST", "/telemetry", valid)
    assert status == 200
    assert body["status"] == "accepted"

    status, _ = request("POST", "/telemetry", {"session_id": "SESSION_TEST"})
    assert 400 <= status < 500


def test_pi_command_without_connected_pi():
    payload = {
        "type": "CUSTOM_COMMAND",
        "session_id": "SESSION_TEST",
        "command": {"relay": 1},
    }
    status, body = request("POST", "/pi/command", payload)
    assert status == 200
    assert body["sent"] is False
    assert body["command"] == payload

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


DEFAULT_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000")


def parse_command(raw: str) -> dict:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise argparse.ArgumentTypeError(f"command must be valid JSON: {error}") from error

    if not isinstance(value, dict):
        raise argparse.ArgumentTypeError("command must be a JSON object")

    return value


def post_json(base_url: str, payload: dict) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/pi/command",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=10) as response:
        body = response.read().decode("utf-8")
        return response.status, json.loads(body) if body else {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a command to the connected Raspberry Pi.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Backend URL, for example http://192.168.1.20:8000")
    parser.add_argument("--type", default="CUSTOM_COMMAND", help="Command type sent to the Pi")
    parser.add_argument("--session-id", default="MANUAL", help="Session id included in the command")
    parser.add_argument("--command", type=parse_command, required=True, help='Command JSON, for example "{\"relay\": 1}"')
    args = parser.parse_args()

    payload = {
        "type": args.type,
        "session_id": args.session_id,
        "command": args.command,
    }

    try:
        status, body = post_json(args.base_url, payload)
    except urllib.error.URLError as error:
        print(f"Could not reach backend at {args.base_url}: {error}", file=sys.stderr)
        return 1

    print(json.dumps(body, indent=2))
    if status != 200 or not body.get("sent"):
        print("Pi is not connected to the backend websocket.", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

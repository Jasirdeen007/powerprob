#!/usr/bin/env python3
"""
Pi UART ↔ MQTT Bridge for PowerProbe battery tester.

Receives commands from the backend via MQTT and forwards them to ESP32 via UART.
Receives telemetry from ESP32 via UART and publishes it to MQTT for the backend.

UART protocol (ESP32 → Pi):
    elapsed,current,temp,voltage\n
    Example: 0,0.50,28.74,12.61\n

UART protocol (Pi → ESP32):
    1,0\n  → Start testing
    0,1\n  → Stop testing
    0,0\n  → No action

MQTT topics (same as ESP32 direct-connect, Pi acts as transparent bridge):
    powerprobe/team6/esp32-001/command   (subscribe — receive commands from backend)
    powerprobe/team6/esp32-001/telemetry (publish   — send telemetry CSV to backend)
    powerprobe/team6/esp32-001/status    (publish   — send device status JSON to backend)
"""

import argparse
import csv
import io
import json
import logging
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import serial
except ImportError:
    print("ERROR: pyserial not installed. Run: pip install pyserial")
    sys.exit(1)

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("ERROR: paho-mqtt not installed. Run: pip install paho-mqtt")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("pi_bridge")

MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
TOPIC_PREFIX = "powerprobe/team6"
DEVICE_ID = "esp32-001"

COMMAND_TOPIC = f"{TOPIC_PREFIX}/{DEVICE_ID}/command"
TELEMETRY_TOPIC = f"{TOPIC_PREFIX}/{DEVICE_ID}/telemetry"
STATUS_TOPIC = f"{TOPIC_PREFIX}/{DEVICE_ID}/status"

DEFAULT_SERIAL_PORT = "/dev/ttyAMA0"
DEFAULT_BAUD_RATE = 115200
STATUS_INTERVAL_S = 10
TELEMETRY_INTERVAL_S = 1
HEARTBEAT_INTERVAL_S = 30


class PiBridge:
    def __init__(self, serial_port: str, baud_rate: int, session_id: str, user_id: str):
        self.serial_port = serial_port
        self.baud_rate = baud_rate
        self.session_id = session_id
        self.user_id = user_id

        self.ser: serial.Serial | None = None
        self.mqtt_client = mqtt.Client(
            client_id=f"pi-bridge-{int(time.time())}",
            clean_session=True,
            protocol=mqtt.MQTTv311,
        )

        self.test_running = False
        self.test_start_time: float | None = None
        self.last_status_time = 0.0
        self.last_telemetry_time = 0.0
        self.telemetry_count = 0
        self.running = True

    def start(self):
        log.info("Starting Pi UART↔MQTT bridge")
        log.info("  Serial port: %s @ %d baud", self.serial_port, self.baud_rate)
        log.info("  MQTT broker: %s:%d", MQTT_BROKER, MQTT_PORT)
        log.info("  Session ID:  %s", self.session_id)
        log.info("  Command topic:   %s", COMMAND_TOPIC)
        log.info("  Telemetry topic: %s", TELEMETRY_TOPIC)
        log.info("  Status topic:    %s", STATUS_TOPIC)

        self._connect_serial()
        self._connect_mqtt()
        self._publish_status("idle")

        signal.signal(signal.SIGINT, self._handle_signal)
        signal.signal(signal.SIGTERM, self._handle_signal)

        self._loop()

    def _handle_signal(self, signum, frame):
        log.info("Shutdown signal received")
        self.running = False

    def _connect_serial(self):
        log.info("Opening serial port %s ...", self.serial_port)
        self.ser = serial.Serial(
            self.serial_port,
            self.baud_rate,
            timeout=1,
        )
        log.info("Serial port opened")

    def _connect_mqtt(self):
        self.mqtt_client.on_connect = self._on_mqtt_connect
        self.mqtt_client.on_message = self._on_mqtt_message
        self.mqtt_client.on_disconnect = self._on_mqtt_disconnect
        self.mqtt_client.reconnect_delay_set(min_delay=1, max_delay=30)

        log.info("Connecting to MQTT broker %s:%d ...", MQTT_BROKER, MQTT_PORT)
        self.mqtt_client.connect_async(MQTT_BROKER, MQTT_PORT, keepalive=60)
        self.mqtt_client.loop_start()
        log.info("MQTT client started")

    def _on_mqtt_connect(self, client, userdata, flags, rc):
        if rc == 0:
            log.info("MQTT connected, subscribing to %s", COMMAND_TOPIC)
            client.subscribe(COMMAND_TOPIC, qos=1)
        else:
            log.warning("MQTT connect failed rc=%d", rc)

    def _on_mqtt_disconnect(self, client, userdata, rc):
        log.warning("MQTT disconnected rc=%d", rc)

    def _on_mqtt_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8") or "{}")
            cmd_type = payload.get("type", "")
            cmd_session = payload.get("session_id", "")
            log.info("Command received: type=%s session=%s", cmd_type, cmd_session)

            if cmd_type == "START_PROFILE":
                if cmd_session:
                    self.session_id = cmd_session
                if not self.test_running:
                    self.test_start_time = time.time()
                    self.telemetry_count = 0
                self.test_running = True
                self._send_uart_start()
                self._publish_status("running")

            elif cmd_type in ("STOP_PROFILE", "PAUSE_PROFILE"):
                self._send_uart_stop()
                self.test_running = False
                self._publish_status("idle")
                log.info("Stop/Pause sent to ESP32")

            elif cmd_type == "RESUME_PROFILE":
                if self.session_id:
                    self.test_running = True
                    self._send_uart_start()
                    self._publish_status("running")
                log.info("Resume sent to ESP32")

        except Exception as e:
            log.error("Failed to process MQTT command: %s", e)

    def _send_uart_start(self):
        if self.ser and self.ser.is_open:
            self.ser.write(b"1,0\n")
            self.ser.flush()
            log.info("UART → ESP32: START (1,0)")

    def _send_uart_stop(self):
        if self.ser and self.ser.is_open:
            self.ser.write(b"0,1\n")
            self.ser.flush()
            log.info("UART → ESP32: STOP (0,1)")

    def _read_uart(self):
        if not self.ser or not self.ser.is_open:
            return
        try:
            while self.ser.in_waiting > 0:
                line = self.ser.readline()
                if not line:
                    continue
                text = line.decode("utf-8", errors="replace").strip()
                if not text:
                    continue
                self._handle_uart_line(text)
        except Exception as e:
            log.warning("UART read error: %s", e)

    def _handle_uart_line(self, line: str):
        parts = line.split(",")
        if len(parts) < 5:
            log.debug("UART ignoring short line: %s", line)
            return

        try:
            elapsed_s = float(parts[0])
            current_a = float(parts[1])
            voltage_v = float(parts[2])
            mosfet_temp = float(parts[3])
            battery_temp = float(parts[4])
        except ValueError:
            log.debug("UART ignoring unparseable line: %s", line)
            return

        now = datetime.now(timezone.utc)
        timestamp_iso = now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"

        csv_line = f"{timestamp_iso},{current_a:.2f},{voltage_v:.2f},{mosfet_temp:.2f},{battery_temp:.2f}"

        result = self.mqtt_client.publish(TELEMETRY_TOPIC, csv_line, qos=0)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            self.telemetry_count += 1
            log.debug("MQTT publish ok: %s", csv_line)
        else:
            log.warning("MQTT publish failed rc=%d", result.rc)

    def _publish_status(self, state: str):
        status = {
            "device_id": DEVICE_ID,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "state": state,
            "active_session_id": self.session_id if self.test_running else "",
            "user_id": self.user_id,
            "profile": "UART_BRIDGE",
            "transport": "uart",
            "telemetry_count": self.telemetry_count,
        }
        self.mqtt_client.publish(STATUS_TOPIC, json.dumps(status), qos=1, retain=True)

    def _loop(self):
        while self.running:
            self._read_uart()

            now = time.time()
            if now - self.last_status_time >= HEARTBEAT_INTERVAL_S:
                self.last_status_time = now
                self._publish_status("running" if self.test_running else "idle")

            time.sleep(0.01)

        log.info("Shutting down bridge")
        self._publish_status("idle")
        self._send_uart_stop()
        self.mqtt_client.loop_stop()
        self.mqtt_client.disconnect()
        if self.ser and self.ser.is_open:
            self.ser.close()
        log.info("Bridge stopped")


def main():
    global MQTT_BROKER, MQTT_PORT, TOPIC_PREFIX, DEVICE_ID
    global COMMAND_TOPIC, TELEMETRY_TOPIC, STATUS_TOPIC

    parser = argparse.ArgumentParser(description="PowerProbe Pi UART↔MQTT Bridge")
    parser.add_argument("--serial-port", default=DEFAULT_SERIAL_PORT, help="UART serial port")
    parser.add_argument("--baud-rate", type=int, default=DEFAULT_BAUD_RATE, help="UART baud rate")
    parser.add_argument("--session-id", default="", help="Session ID for this test run")
    parser.add_argument("--user-id", default="", help="User ID for this test run")
    parser.add_argument("--mqtt-broker", default=MQTT_BROKER, help="MQTT broker hostname")
    parser.add_argument("--mqtt-port", type=int, default=MQTT_PORT, help="MQTT broker port")
    parser.add_argument("--topic-prefix", default=TOPIC_PREFIX, help="MQTT topic prefix")
    parser.add_argument("--device-id", default=DEVICE_ID, help="Device ID for topic path")
    args = parser.parse_args()

    MQTT_BROKER = args.mqtt_broker
    MQTT_PORT = args.mqtt_port
    TOPIC_PREFIX = args.topic_prefix
    DEVICE_ID = args.device_id
    COMMAND_TOPIC = f"{TOPIC_PREFIX}/{DEVICE_ID}/command"
    TELEMETRY_TOPIC = f"{TOPIC_PREFIX}/{DEVICE_ID}/telemetry"
    STATUS_TOPIC = f"{TOPIC_PREFIX}/{DEVICE_ID}/status"

    bridge = PiBridge(
        serial_port=args.serial_port,
        baud_rate=args.baud_rate,
        session_id=args.session_id,
        user_id=args.user_id,
    )
    bridge.start()


if __name__ == "__main__":
    main()

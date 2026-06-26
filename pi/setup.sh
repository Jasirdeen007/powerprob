#!/bin/bash
# Run this ONCE on the Pi to set up the bridge as an auto-start service.
# Usage: chmod +x setup.sh && sudo ./setup.sh

set -e

INSTALL_DIR="/home/pi/powerprobe"
SERVICE_NAME="powerprobe-bridge"

echo "=== PowerProbe Pi Bridge Setup ==="

# Create install directory
mkdir -p "$INSTALL_DIR"

# Copy bridge script
cp pi_bridge.py "$INSTALL_DIR/pi_bridge.py"
chmod +x "$INSTALL_DIR/pi_bridge.py"

# Install Python dependencies
pip3 install pyserial paho-mqtt

# Install systemd service
cp powerprobe-bridge.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

echo ""
echo "=== Setup complete ==="
echo "Bridge is running and will auto-start on boot."
echo ""
echo "Useful commands:"
echo "  sudo systemctl status $SERVICE_NAME    # Check if running"
echo "  sudo systemctl restart $SERVICE_NAME   # Restart"
echo "  sudo journalctl -u $SERVICE_NAME -f    # View live logs"
echo "  sudo systemctl stop $SERVICE_NAME      # Stop"

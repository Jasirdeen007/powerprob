PowerProbe Raspberry Pi service setup

Use the MQTT service for the current PowerProbe lab flow.

Files:
- powerprobe_pi_mqtt.py
- powerprobe-pi-mqtt.service

Expected Pi folder:
/home/team6/powerprobe

Install:
mkdir -p /home/team6/powerprobe
cp powerprobe_pi_mqtt.py /home/team6/powerprobe/
python3 -m venv /home/team6/powerprobe/.venv
/home/team6/powerprobe/.venv/bin/python -m pip install paho-mqtt
sudo cp powerprobe-pi-mqtt.service /etc/systemd/system/powerprobe-pi.service
sudo systemctl daemon-reload
sudo systemctl enable --now powerprobe-pi.service
sudo systemctl restart powerprobe-pi.service

Check:
sudo systemctl status powerprobe-pi.service
journalctl -u powerprobe-pi.service -f

The service connects outward to broker.emqx.io:1883 with topic prefix powerprobe/team6.

PowerProbe Raspberry Pi service setup

Use the MQTT service for the current PowerProbe lab flow.

Files:
- powerprobe-pi-mqtt.service

Expected Pi folder:
/home/team6/powerprobe

Install:
sudo cp powerprobe-pi-mqtt.service /etc/systemd/system/powerprobe-pi.service
sudo systemctl daemon-reload
sudo systemctl enable --now powerprobe-pi.service
sudo systemctl restart powerprobe-pi.service

Check:
sudo systemctl status powerprobe-pi.service
journalctl -u powerprobe-pi.service -f

The service connects outward to broker.emqx.io:1883 with topic prefix powerprobe/team6.

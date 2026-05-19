param(
    [Parameter(Mandatory = $true)]
    [string]$PiHost,

    [string]$PiUser = "pi",

    [string]$RemoteDir = "~/powerprobe"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Files = @(
    Join-Path $ScriptDir "mock_pi.py"
    Join-Path $ScriptDir "pi_command_client.py"
    Join-Path $ScriptDir "powerprobe-pi.service.example"
)

Write-Host "Creating $RemoteDir on $PiUser@$PiHost ..."
ssh "$PiUser@$PiHost" "mkdir -p $RemoteDir"

Write-Host "Copying Pi websocket scripts ..."
scp $Files "$PiUser@$PiHost`:$RemoteDir/"

Write-Host ""
Write-Host "Done. On the Raspberry Pi, run:"
Write-Host "  cd $RemoteDir"
Write-Host "  python3 -m pip install --user websockets"
Write-Host "  python3 mock_pi.py ws://YOUR_LAPTOP_IP:8000/ws/pi"
Write-Host ""
Write-Host "For receiving backend commands on the Pi instead:"
Write-Host "  python3 pi_command_client.py ws://YOUR_LAPTOP_IP:8000/ws/pi"
Write-Host ""
Write-Host "For boot startup, edit powerprobe-pi.service.example on the Pi, then install it as:"
Write-Host "  sudo cp powerprobe-pi.service.example /etc/systemd/system/powerprobe-pi.service"
Write-Host "  sudo systemctl daemon-reload"
Write-Host "  sudo systemctl enable --now powerprobe-pi.service"

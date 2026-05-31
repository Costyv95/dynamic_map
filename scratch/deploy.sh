#!/bin/bash
# deploy.sh - Instantly deploys local custom_components/dynamic_map to remote HAOS and restarts the core.
# Uses rsync for blazing-fast synchronization, automatically bypassing node_modules and cache folders.

set -e

LOCAL_PATH="/home/costi/workspace/dynamic_map/custom_components/dynamic_map/"
REMOTE_HOST="ghemo_smoto@192.168.1.55"
REMOTE_PATH="/homeassistant/custom_components/dynamic_map/"

# 0. Execute automatic version cache-busting using Git commit author date/time
echo "Executing Git-Based Auto-Versioning..."
PYTHONUNBUFFERED=1 /home/costi/miniforge3/envs/ha_agent/bin/python3 /home/costi/workspace/dynamic_map/scratch/auto_version.py
echo ""

# 1. Sync files via rsync using sudo on remote side to override root permission barriers
echo "Syncing code files..."
rsync -avz --delete \
      --exclude="node_modules" \
      --exclude="__pycache__" \
      --exclude="*.log" \
      --exclude=".pytest_cache" \
      --rsync-path="sudo rsync" \
      "$LOCAL_PATH" "$REMOTE_HOST:$REMOTE_PATH"

# Read resolved version string
VERSION_STR=$(cat "/home/costi/workspace/dynamic_map/scratch/current_version.txt")
echo "Resolved version string: $VERSION_STR"
echo ""

# 2. SSH into remote host to trigger Lovelace resource update & Home Assistant Core restart
echo "Connecting to remote HAOS to trigger Lovelace resource update & core restart..."
REMOTE_COMMANDS=$(cat << EOF
set -e

# Update Lovelace resource version directly in .storage database
echo "Updating Lovelace resource version to $VERSION_STR..."
sudo python3 -c '
import json
path = "/homeassistant/.storage/lovelace_resources"
with open(path, "r") as f:
    data = json.load(f)

updated = False
for item in data["data"]["items"]:
    if item["url"].startswith("/dynamic_map_ui/custom-svg-map.js"):
        item["url"] = "/dynamic_map_ui/custom-svg-map.js?v=$VERSION_STR"
        updated = True

if updated:
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print("Lovelace resource successfully updated to $VERSION_STR!")
else:
    print("Warning: Lovelace resource /dynamic_map_ui/custom-svg-map.js not found in .storage/lovelace_resources.")
'

echo "Triggering Home Assistant restart..."
if command -v docker &> /dev/null; then
    echo "Using Docker: sudo docker restart homeassistant"
    sudo docker restart homeassistant
elif command -v ha &> /dev/null; then
    echo "Using HA CLI: ha core restart"
    ha core restart || sudo ha core restart
else
    # Systemd service check fallback
    if systemctl is-active --quiet home-assistant@homeassistant; then
        echo "Using Systemd: restarting home-assistant service"
        sudo systemctl restart home-assistant@homeassistant
    else
        echo "Warning: No direct command-line helper found. Calling HA API local service..."
        sudo ha core restart 2>/dev/null || echo "Could not execute automatic restart. Please trigger a restart of Home Assistant manually from the UI."
    fi
fi
EOF
)

ssh -o ConnectTimeout=5 "$REMOTE_HOST" "$REMOTE_COMMANDS"

echo ""
echo "=== 🎉 Deployment & Restart Completed Successfully! ==="

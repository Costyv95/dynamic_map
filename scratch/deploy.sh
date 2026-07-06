#!/bin/bash
# deploy.sh — Deploys custom_components/dynamic_map to a remote HAOS box and restarts core.
#
# Version stamping happens in a temporary build directory so the repository
# sources stay clean; only the deployed copy carries the cache-busting ?v= strings.
#
# Overridable via env:
#   DYNAMIC_MAP_REMOTE       (default ghemo_smoto@192.168.1.55)
#   DYNAMIC_MAP_REMOTE_PATH  (default /homeassistant/custom_components/dynamic_map/)

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_ROOT/custom_components/dynamic_map"
REMOTE_HOST="${DYNAMIC_MAP_REMOTE:-ghemo_smoto@192.168.1.55}"
REMOTE_PATH="${DYNAMIC_MAP_REMOTE_PATH:-/homeassistant/custom_components/dynamic_map/}"

# 0. Build: copy sources to a temp dir and stamp cache-busting versions there
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

echo "Building deploy copy in $BUILD_DIR..."
rsync -a \
      --exclude="node_modules" \
      --exclude="__pycache__" \
      --exclude=".pytest_cache" \
      --exclude="tests" \
      --exclude="package-lock.json" \
      --exclude="*.log" \
      "$SRC/" "$BUILD_DIR/dynamic_map/"

echo "Stamping cache-busting version..."
python3 "$REPO_ROOT/scratch/auto_version.py" "$BUILD_DIR/dynamic_map/frontend"
VERSION_STR=$(cat "$REPO_ROOT/scratch/current_version.txt")
echo "Resolved version string: $VERSION_STR"
echo ""

# 1. Sync build to remote (sudo rsync overrides root permission barriers)
echo "Syncing code files to $REMOTE_HOST..."
rsync -avz --delete \
      --rsync-path="sudo rsync" \
      "$BUILD_DIR/dynamic_map/" "$REMOTE_HOST:$REMOTE_PATH"

# 2. Update Lovelace resource version & restart HA core
echo "Connecting to remote HAOS to update Lovelace resource & restart core..."
REMOTE_COMMANDS=$(cat << EOF
set -e

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
    print("Warning: /dynamic_map_ui/custom-svg-map.js not found in lovelace_resources.")
'

echo "Triggering Home Assistant restart..."
if command -v docker &> /dev/null; then
    echo "Using Docker: sudo docker restart homeassistant"
    sudo docker restart homeassistant
elif command -v ha &> /dev/null; then
    echo "Using HA CLI: ha core restart"
    ha core restart || sudo ha core restart
else
    if systemctl is-active --quiet home-assistant@homeassistant; then
        echo "Using Systemd: restarting home-assistant service"
        sudo systemctl restart home-assistant@homeassistant
    else
        echo "Warning: No restart helper found. Restart Home Assistant manually from the UI."
    fi
fi
EOF
)

ssh -o ConnectTimeout=5 "$REMOTE_HOST" "$REMOTE_COMMANDS"

echo ""
echo "=== Deployment & Restart Completed Successfully ==="

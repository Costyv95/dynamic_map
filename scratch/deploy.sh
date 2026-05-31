#!/bin/bash
# deploy.sh - Instantly deploys local custom_components/dynamic_map to remote HAOS and restarts the core.
# Uses rsync for blazing-fast synchronization, automatically bypassing node_modules and cache folders.

set -e

LOCAL_PATH="/home/costi/workspace/dynamic_map/custom_components/dynamic_map/"
REMOTE_HOST="ghemo_smoto@192.168.1.55"
REMOTE_PATH="/homeassistant/custom_components/dynamic_map/"

echo "=== 🚀 Starting Blazing-Fast HAOS Deployment ==="
echo "Local source:  $LOCAL_PATH"
echo "Remote target: $REMOTE_HOST:$REMOTE_PATH"
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

echo "Code files synced successfully!"
echo ""

# 2. SSH into remote host to trigger Home Assistant Core restart
echo "Connecting to remote HAOS to trigger core restart..."
REMOTE_COMMANDS=$(cat << 'EOF'
set -e

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
        # If no commands found, call HA core restart via local shell call if HAOS CLI exists
        sudo ha core restart 2>/dev/null || echo "Could not execute automatic restart. Please trigger a restart of Home Assistant manually from the UI."
    fi
fi
EOF
)

ssh -o ConnectTimeout=5 "$REMOTE_HOST" "$REMOTE_COMMANDS"

echo ""
echo "=== 🎉 Deployment & Restart Completed Successfully! ==="

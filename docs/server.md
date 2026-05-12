# Server Migration Guide: HP EliteDesk 800 G5 (Proxmox)

This document outlines the strategy for migrating the Home Assistant smart home ecosystem from a Raspberry Pi (ARM) to an HP EliteDesk 800 G5 Mini PC (x86-64) using Proxmox VE. This architecture enables the `dynamic_map` integration to offload heavy OpenCV image processing to a dedicated microservice.

## Phase 1: Bare Metal Installation

1. **Download Proxmox VE:**
   - Go to the official Proxmox website and download the latest Proxmox VE ISO.
   - Use a tool like **BalenaEtcher** or **Rufus** to flash the ISO onto a USB drive.

2. **Install Proxmox on the HP EliteDesk:**
   - Plug the USB into the HP EliteDesk, plug in an ethernet cable, and boot from the USB.
   - Follow the installation wizard. You will be asked to assign a static IP address to the server (e.g., `192.168.1.100`).
   - Once installed, reboot. You can now unplug the monitor and keyboard from the HP.
   - Open a web browser on your main PC and navigate to `https://192.168.1.100:8006` (bypass the SSL warning) to access the Proxmox Web UI.

## Phase 2: Deploy Home Assistant OS (HAOS)

Instead of manually configuring VMs, we use the community standard **tteck Helper Scripts**:

1. Open the Proxmox Web UI.
2. Click on your node (usually named `pve`) on the left sidebar.
3. Click on **>_ Shell** in the top right to open the terminal.
4. Run the following command to instantly create an official Home Assistant OS VM:
   ```bash
   bash -c "$(wget -qLO - https://github.com/community-scripts/ProxmoxVE/raw/main/vm/haos-vm.sh)"
   ```
5. Follow the prompts (using default settings is generally perfectly fine). 
6. Once complete, start the VM. You can now access your brand new Home Assistant instance at `http://<NEW_HA_IP>:8123`.

## Phase 3: Migration from Raspberry Pi

1. **Create Backup:** On your old Raspberry Pi, go to `Settings > System > Backups`. Click **Create Backup** (Full).
2. **Download Backup:** Once created, click on it and download the `.tar` file to your PC.
3. **Restore to Proxmox:** 
   - Open the new Home Assistant IP in your browser. 
   - Instead of creating a new user on the welcome screen, click the **"Restore from backup"** link.
   - Upload the `.tar` file. 
4. **Wait:** The system will restore everything (integrations, Tailscale, Zigbee/Z-Wave networks, custom files, and the `dynamic_map` integration). Once it reboots, your new server will look exactly like your Pi, but run exponentially faster.

## Phase 4: Deploying the OpenCV "Sidecar" Microservice

Because Home Assistant OS cannot compile `opencv-python-headless`, we will deploy our map generation script in a secondary container.

1. **Create a Docker LXC Container:**
   - Go back to your Proxmox Shell and run the Docker LXC script:
     ```bash
     bash -c "$(wget -qLO - https://github.com/community-scripts/ProxmoxVE/raw/main/ct/docker.sh)"
     ```
   - This creates a lightweight Linux container running Docker.

2. **Deploy the Map Processor API:**
   - SSH into your new Docker LXC container.
   - We will wrap `dxf_processor.py` in a tiny Python Flask API.
   - Create a `docker-compose.yml`:
     ```yaml
     version: '3'
     services:
       map-processor:
         image: python:3.11-slim
         volumes:
           - /path/to/dynamic_map_data:/data
         command: >
           bash -c "pip install ezdxf opencv-python-headless shapely cairosvg flask && python api.py"
         ports:
           - "5000:5000"
     ```
   - **Important:** You will need to mount the exact same `dynamic_map_data` directory to both Home Assistant and this container (either via an NFS share on your router, or using Proxmox bind mounts) so they can read/write the same JSON and SVG files.

## Phase 5: Re-Linking Dynamic Map

1. In the `__init__.py` of the `dynamic_map` HA integration, we will update the `/api/dynamic_map/recompute` endpoint.
2. Instead of calling `dxf_processor.process_dxf()` locally (which fails on HAOS), it will simply make a standard HTTP POST request to the new sidecar:
   ```python
   await session.post("http://<LXC_IP>:5000/process", json={"floor": floor_num})
   ```
3. The sidecar completes the OpenCV math instantly using pre-compiled x86-64 Debian wheels, overwrites the files in the shared folder, and the Home Assistant UI refreshes seamlessly!

# Dynamic Floorplan Map Integration

A full Home Assistant Custom Component that natively embeds a dynamic SVG Map Editor into your Home Assistant sidebar, allowing you to visually configure rooms and shortcuts.

## Features
- **Native Sidebar Editor**: No external Python scripts required. Editor runs directly in Home Assistant.
- **Secure File Saving**: Saves `rooms_floorX.json` and `shortcuts.json` directly to the HA configuration directory via a secure `POST /api/dynamic_map/save` endpoint.
- **Dynamic Frontend Component**: Exposes all SVG assets and JSON files locally for the dashboard to consume.

## Installation (HACS)
1. Open HACS in Home Assistant.
2. Go to **Integrations > Custom Repositories**.
3. Add the URL of this repository and choose **Integration** as the category.
4. Install "Dynamic Floorplan Map" and restart Home Assistant.

## Setup
In your `configuration.yaml`, add:
```yaml
dynamic_map:
```
Restart Home Assistant. You will now see **Map Editor** in your sidebar!

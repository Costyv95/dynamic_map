# Dynamic Map Project

## Overview
Dynamic Map is a Home Assistant Custom Integration designed to provide a highly interactive, dynamic, and automated SVG-based floorplan editor and dashboard. 

The primary goal of this project is to eliminate the need for manual SVG editing or static image maps in Home Assistant. By providing a native, in-browser editor, users can interactively draw rooms, map shortcuts, and configure their smart home devices (especially Roborock vacuums) on top of their real floorplan geometry.

## Architecture
The system is divided into two primary components:

### 1. The Home Assistant Integration (Python Backend)
A native `custom_component` that runs inside the Home Assistant Core. 
- **API**: It securely exposes two REST endpoints (`requires_auth = True`):
  - `POST /api/dynamic_map/save`: Saves map configurations.
  - `GET /api/dynamic_map/state`: Fetches HA entity states and attributes (e.g., for Roborock vacuum room mappings).
- **File System Access**: It writes configuration files (`rooms.json`, `shortcuts.json`) directly to the integration's frontend directory.
- **Panel Registration**: It automatically injects an iframe into the Home Assistant sidebar to serve the frontend editor.

### 2. The Frontend Editor (HTML5/Canvas)
A standalone vanilla JavaScript single-page application (`editor.html`).
- **Unified State**: Operates in either `View Mode` or `Edit Mode`.
- **Canvas Interaction**: Features a dynamic panning, zooming, and automated orientation engine.
- **Object Manipulation**: Supports interactive dragging, point-and-click room definitions, Polygon merging/splitting, and shape manipulation (independent X/Y scaling for shortcuts).
- **Smart Device Integration**: Dynamically fetches and maps Roborock vacuum room configurations directly from Home Assistant entities.
- **HA Exporter**: Automatically generates the required YAML `picture-elements` card code to deploy the live view.

## Core Dependencies
- **Home Assistant**: Tested with HA Core. Requires `http` and `frontend` integrations.
- **PolyBool.js**: Used for the mathematical boolean operations (merging/splitting) of polygon regions in the frontend.
- **HACS**: The project is structured to be deployed seamlessly as a Custom Repository via the Home Assistant Community Store.

# Dynamic Map Project

## Overview
Dynamic Map is a Home Assistant Custom Integration designed to provide a highly interactive, dynamic, and automated SVG-based floorplan editor and dashboard. 

The primary goal of this project is to eliminate the need for manual SVG editing or static image maps in Home Assistant. By providing a native, in-browser editor, users can interactively draw rooms, map shortcuts, and configure their smart home devices (especially Roborock vacuums) on top of their real floorplan geometry.

## Architecture
The system is divided into two primary components:

### 1. The Home Assistant Integration (Python Backend)
A native `custom_component` that runs inside the Home Assistant Core, organized as `__init__.py` (setup), `views.py` (HTTP API), `storage.py` (HA-free filesystem rules, unit-tested in `tests/`), and `const.py`.
- **API**: All REST endpoints require HA authentication; mutating endpoints additionally require an admin user:
  - `POST /api/dynamic_map/save` — saves per-floor map data. Only the managed filenames (`rooms/shortcuts/config_floorN.json`, `bg_floorN.png`) are accepted, with structural validation of JSON payloads.
  - `POST /api/dynamic_map/delete_floor` — deletes one floor's data files.
  - `POST /api/dynamic_map/recompute` — proxies to the DXF/SVG sidecar (`sidecar_url` from configuration.yaml).
  - `GET /api/dynamic_map/state` — one entity's state and attributes.
  - `GET /api/dynamic_map/entities` — all entities for the editor autocomplete.
  - `GET /api/dynamic_map/files` — DXF/SVG sources and custom icons in the data dir.
  - `GET /api/dynamic_map/floors` — floors discovered from data files, plus the integration version.
  - `GET /api/dynamic_map/registry` — HA floors and areas (with a default light per area).
  - `GET /api/dynamic_map/roborock_rooms` — Roborock segments via `roborock.get_maps`.
- **File System Access**: It writes configuration files (`rooms_floorX.json`, `shortcuts_floorX.json`) directly to the isolated `dynamic_map_data` directory to prevent HACS updates from overwriting user configuration data.
- **Standalone Processing**: Heavy geometric math (DXF to SVG conversions) is performed by the sidecar (`server/`) outside the HA process to prevent blocking the event loop.

### 2. The Frontend Editor (HTML5/Canvas)
A standalone vanilla JavaScript single-page application (`editor.html`).
- **Unified State**: Operates in either `View Mode` or `Edit Mode`.
- **Canvas Interaction**: Features a dynamic panning, zooming, and automated orientation engine.
- **Object Manipulation**: Supports interactive dragging, point-and-click room definitions, Polygon merging/splitting, and shape manipulation. Includes robust entity search via a custom autocomplete dropdown (replacing standard datalists).
- **Smart Device Integration**: Dynamically fetches and maps Roborock vacuum room configurations directly from Home Assistant entities. Utilizes `binary_sensor.<vac>_charging` for precise dock-snapping, and features advanced `requestAnimationFrame` SVG boundary-wandering for live tracking. Handles both numerical IDs and string-based room naming natively.

## Core Dependencies
- **Home Assistant**: Tested with HA Core. Requires `http` and `frontend` integrations.
- **PolyBool.js**: Used for the mathematical boolean operations (merging/splitting) of polygon regions in the frontend.
- **HACS**: The project is structured to be deployed seamlessly as a Custom Repository via the Home Assistant Community Store.

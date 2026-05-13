> Auto-generated 2026-05-13 23:58. Regenerate with /map.

# Dynamic Map Project

## Overview
Dynamic Map is a Home Assistant Custom Integration providing a visual, SVG-based floorplan editor and live dashboard tracking (specifically optimized for Roborock vacuum integration).

## Module Topology

### `/custom_components/dynamic_map`
The core Home Assistant integration.
- `__init__.py`: API backend handling `/api/dynamic_map/save` and `/api/dynamic_map/state`. Now delegates heavy map generation to the `server/` sidecar container.
- `manifest.json`: HACS compatibility manifest.

### `/custom_components/dynamic_map/frontend`
The web assets served to the HA frontend.
- `editor.html` & `editor.js`: The standalone visual Map Editor (HTML5 Canvas).
- `custom-svg-map.js`: The Custom Lovelace Card providing live SVG rendering and vacuum animation tracking.
- `editorUI.js` & `editorUtils.js`: Separated rendering and math logic for the editor.
- `shortcuts/`: Sub-modules containing shortcut-specific logic (e.g., `VacuumShortcut.js`).
- `polybool.min.js`: Boolean geometry math library.
- *Contains `token_extractor.py` flagged for removal/migration.*

### `[NEW] /server`
The sidecar microservice.
- `api.py`: A Flask wrapper for processing DXF maps via OpenCV without crashing Home Assistant OS.
- `dxf_processor.py`: Offloaded from the frontend, handles polygon conversion and SVG generation.
- `docker-compose.yml`: Container setup for the Python sidecar.

### `/docs`
Documentation, architecture plans, and session handoffs.
- `handoffs/`: Historical context and development logs.
- `maintenance.md`: Technical debt tracker.
- `project.md`: Project architecture.
- `server.md`: Server deployment strategies and sidecar migration notes.
- `shortcut_design.md`: Specific design specs for the shortcut menu ecosystem.

### `/ha_test`
A Docker-Compose based isolated Home Assistant environment for local integration testing.
- `docker-compose.yml`: Spawns the test HA instance.
- `/config/dynamic_map_data/`: Contains the actual `.json` configurations and `.png` background images managed by the editor.

## Key Entry Points
1. **HA Backend Integration**: `custom_components/dynamic_map/__init__.py` (Registers API endpoints).
2. **Visual Editor UI**: `custom_components/dynamic_map/frontend/editor.html` (Draw rooms, map vacuum ids, setup shortcuts).
3. **Lovelace Dashboard Card**: `custom_components/dynamic_map/frontend/custom-svg-map.js` (Live tracking of smart devices).
4. **Sidecar API**: `server/api.py` (Remote DXF processing).

## Critical Hotspots
- **Vacuum Tracking Logic (`custom-svg-map.js`)**: Highly complex coordinate interpolation, SVG path injection, and Home Assistant state synchronization.
- **Room Mapping Engine (`editor.html` / `editor.js`)**: Real-time JSON manipulation and inverse data structure mapping between drawn SVGs and HA string enums.
- **Gravity Well / Technical Debt**: The `frontend/` directory currently contains `token_extractor.py` which must be moved to the `server/` directory to minimize production payload and adhere to strict frontend segregation.

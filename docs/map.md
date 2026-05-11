> Auto-generated 2026-05-11 12:18. Regenerate with /map.

# Dynamic Map Project

## Overview
Dynamic Map is a Home Assistant Custom Integration providing a visual, SVG-based floorplan editor and live dashboard tracking (specifically optimized for Roborock vacuum integration).

## Module Topology

### `/custom_components/dynamic_map`
The core Home Assistant integration.
- `__init__.py`: API backend handling `/api/dynamic_map/save` and `/api/dynamic_map/state`, writes data to `/config/dynamic_map_data/`.
- `manifest.json`: HACS compatibility manifest.

### `/custom_components/dynamic_map/frontend`
The web assets served to the HA frontend.
- `editor.html`: The standalone visual Map Editor (HTML5 Canvas).
- `custom-svg-map.js`: The Custom Lovelace Card providing live SVG rendering and vacuum animation tracking on the HA Dashboard.
- `polybool.min.js`: Boolean geometry math library.
- *Contains legacy development scripts (`test_*.py`, `dxf_processor.py`) flagged for removal.*

### `/docs`
Documentation, architecture plans, and session handoffs.
- `handoffs/`: Historical context and development logs.
- `maintenance.md`: Technical debt tracker.
- `project.md`: Project architecture.
- `todo.md`: Outstanding tasks.

### `/ha_test`
A Docker-Compose based isolated Home Assistant environment for local integration testing.
- `docker-compose.yml`: Spawns the test HA instance.
- `/config/dynamic_map_data/`: Contains the actual `.json` configurations and `.png` background images managed by the editor.

## Key Entry Points
1. **HA Backend Integration**: `custom_components/dynamic_map/__init__.py` (Registers API endpoints and static paths).
2. **Visual Editor UI**: `custom_components/dynamic_map/frontend/editor.html` (Draw rooms, map vacuum ids).
3. **Lovelace Dashboard Card**: `custom_components/dynamic_map/frontend/custom-svg-map.js` (Live tracking of smart devices).

## Critical Hotspots
- **Vacuum Tracking Logic (`custom-svg-map.js`)**: Highly complex coordinate interpolation, SVG path injection, and Home Assistant state synchronization (relying heavily on `binary_sensor.<vac>_charging`).
- **Room Mapping Engine (`editor.html`)**: Real-time JSON manipulation and inverse data structure mapping between drawn SVGs and HA string enums.
- **Frontend Python Clutter**: The `frontend/` directory currently contains 20+ development scripts that should be moved to a `scripts/` directory to minimize production payload.

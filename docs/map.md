> Auto-generated 2026-06-01 10:01. Regenerate with /map.

# Dynamic Map Project Map

## Overview
The **Dynamic Map** project is a custom Home Assistant integration that renders an interactive, vector-based SVG floorplan map within a Lovelace card. It provides a visual interface for managing rooms and triggering hardware actions (like Vacuum paths, Lights, and Twinkly LED matrices) via configured shortcuts.

## Module Topology

- **`/custom_components/dynamic_map/`**: The core Home Assistant integration package.
  - `__init__.py`: Setup entry point — registers views, static paths, and the sidebar panel.
  - `views.py`: All authenticated REST API views (`/api/dynamic_map/*`).
  - `storage.py`: HA-free filename rules, floor discovery, and payload validation (unit-tested in `/tests/`).
  - `const.py`: Domain constants and configuration keys.
  - `manifest.json`: HACS/Home Assistant component metadata.

- **`/custom_components/dynamic_map/frontend/`**: The JavaScript/HTML application containing both the Lovelace Card and the visual Editor.
  - `custom-svg-map.js`: The Web Component for the Lovelace Map Card (`<custom-svg-map>`). Handles rendering the SVG and executing configured shortcuts.
  - `editor.html` & `editor.js`: The standalone Visual Editor interface for configuring the map, rooms, and mapping shortcuts.
  - **`/card/`**: Core logic for the Lovelace Map Card.
    - `MapBuilder.js`: SVG geometry construction logic.
    - `OverlayManager.js`: Handles dynamic rendering of context menus and sliders when a shortcut is triggered.
    - `CameraManager.js`: Handles zoom and pan interactions.
  - **`/editor/`**: UI logic specific to the Visual Editor.
    - `EditorUIManager.js`: Main state and event binding controller for the sidebar.
    - `ShortcutConfigUI.js`: Renders the configuration forms for mapping complex custom shortcuts.
  - **`/shortcuts/`**: The unified shortcut compositor.
    - `ShortcutFactory.js`: Builds a `MapShortcut` from each JSON config.
    - `MapShortcut.js`: The single shortcut class — evaluates conditional states, builds a declarative layout, and renders it through `ComponentRegistry` (all types: generic, light, vacuum, sensor).
    - `ConditionEvaluator.js` / `TemplateEvaluator.js`: State-condition and `{…}` template evaluation.
    - `components/`: Declarative renderers (gauges, badges, timelines, calendar, alarm clock, …).

  - **`/shared/`**: Code shared between the Card and the Editor.
    - `ApiManager.js`: Authenticated HTTP requests to the HA backend.
    - `MapGeometry.js`: Polygon math and color parsing.
    - `OrientationProps.js`: Per-orientation (horizontal/vertical) property resolution and getters/setters.
    - `ActionRunner.js`: Unified execution of shortcut actions (toggle, service calls, vacuum remapping).
  - **`/tests/`**: Unit testing suite (Vitest).

- **`/server/`**: The DXF/SVG processing sidecar (Flask + OpenCV/ezdxf, Docker).
  - `dxf_processor.py`: Parses `.dxf`/`.svg` floorplans into room polygons + background PNGs.
  - `api.py` & `docker-compose.yml`: The `POST /process` HTTP wrapper the integration's `/recompute` endpoint calls (`sidecar_url` in configuration.yaml; env: `DYNAMIC_MAP_DATA_DIR`, `DYNAMIC_MAP_PORT`).

- **`/docs/`**: Project documentation, handoff logs, and technical specs.

## Key Entry Points
1. **Lovelace Frontend:** `custom_components/dynamic_map/frontend/custom-svg-map.js`
2. **Editor Interface:** `custom_components/dynamic_map/frontend/editor.html`
3. **Backend Integration:** `custom_components/dynamic_map/__init__.py`
4. **DXF Processing CLI:** `server/dxf_processor.py`

## Critical Hotspots
- **`OverlayManager.js`**: Contains complex DOM injection logic for sliders, toggles, and parsing HA entity states. Frequently modified for hardware integrations (e.g. Twinkly, Vacuums).
- **`views.py`**: Manages the HA API endpoints (`/api/dynamic_map/...`) — auth required everywhere, admin required for writes.
- **`ShortcutConfigUI.js`**: Contains heavy UI rendering logic for the Editor sidebar, expanding rapidly as new features are added. (Potential Gravity Well)

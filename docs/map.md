> Auto-generated 2026-05-15 09:59. Regenerate with /map.

# Dynamic Map Project Map

## Overview
The **Dynamic Map** project is a custom Home Assistant integration that renders an interactive, vector-based SVG floorplan map within a Lovelace card. It provides a visual interface for managing rooms and triggering hardware actions (like Vacuum paths, Lights, and Twinkly LED matrices) via configured shortcuts.

## Module Topology

- **`/custom_components/dynamic_map/`**: The core Home Assistant integration package.
  - `__init__.py`: The main Python backend entry point. Handles setup, REST API registration for saving configurations, and serving the frontend static files.
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
  - **`/shortcuts/`**: Object-Oriented classes for rendering SVG interactive items.
    - `ShortcutFactory.js`: Factory mapping JSON configs to subclasses.
    - `MapShortcut.js`: Base class for position tracking and event handling.
    - `GenericShortcut.js`: General-purpose shortcuts (Buttons, Toggles) with `<ha-icon>` support.
    - `VacuumShortcut.js`: Specialized shortcut for Roborock zone/room cleaning.
  - **`/shared/`**: Code shared between the Card and the Editor.
    - `ApiManager.js`: Handles HTTP requests to the HA backend to save configurations.
  - **`/tests/`**: Unit testing suite (Vitest).

- **`/server/`** (Legacy/Standalone processing?):
  - `dxf_processor.py`: A Python script for parsing and optimizing raw `.dxf` CAD floorplans into JSON polygons for the frontend.
  - `api.py` & `docker-compose.yml`: Potentially legacy standalone server logic prior to full HA Custom Component integration.

- **`/docs/`**: Project documentation, handoff logs, and technical specs.

## Key Entry Points
1. **Lovelace Frontend:** `custom_components/dynamic_map/frontend/custom-svg-map.js`
2. **Editor Interface:** `custom_components/dynamic_map/frontend/editor.html`
3. **Backend Integration:** `custom_components/dynamic_map/__init__.py`
4. **DXF Processing CLI:** `server/dxf_processor.py`

## Critical Hotspots
- **`OverlayManager.js`**: Contains complex DOM injection logic for sliders, toggles, and parsing HA entity states. Frequently modified for hardware integrations (e.g. Twinkly, Vacuums).
- **`__init__.py`**: Manages the HA API endpoints (`/api/dynamic_map/...`) which have strict CORS/auth requirements.
- **`ShortcutConfigUI.js`**: Contains heavy UI rendering logic for the Editor sidebar, expanding rapidly as new features are added. (Potential Gravity Well)

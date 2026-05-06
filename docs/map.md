> Auto-generated 2026-05-06 09:54. Regenerate with /map.

# Dynamic Map Project

## Overview
Dynamic Map is a Home Assistant Custom Integration designed to provide a highly interactive, dynamic, and automated SVG-based floorplan editor and dashboard. It allows users to visually configure rooms and shortcuts directly within the Home Assistant interface, saving configurations securely to the host machine.

## Module Topology
- `custom_components/dynamic_map`: The Home Assistant backend custom component. Handles API routing, panel registration, and persistent storage of configurations. [NEW]
- `custom_components/dynamic_map/frontend`: The primary frontend application directory containing the SPA Map Editor (`editor.html`), UI assets (JS, SVGs, images), and various legacy DXF-to-SVG Python utility scripts. [NEW]
- `docs`: Core project documentation, roadmap (`todo.md`), and high-level architecture (`project.md`).
- `docs/handoffs`: Historical development session handoff summaries detailing architectural evolutions.

## Key Entry Points
- `custom_components/dynamic_map/__init__.py`: The core Home Assistant integration initialization. It registers the static paths, injects the sidebar iframe panel, and exposes the `POST /api/dynamic_map/save` API via `DynamicMapSaveView`.
- `custom_components/dynamic_map/frontend/editor.html`: The standalone vanilla JavaScript single-page application that serves as the interactive SVG editor.
- `custom_components/dynamic_map/frontend/custom-svg-map.js`: The Lovelace custom card implementation used to render the interactive map on Home Assistant dashboards.

## Critical Hotspots
- `custom_components/dynamic_map/frontend`: **Gravity Well.** This directory currently violates separation of concerns. It houses the production frontend (`editor.html`, JS dependencies), but is severely cluttered with over 70 files including legacy Python test scripts (`test_bbox.py`, `test_svg.py`), intermediate processing files (`dxf_processor.py`), raw DXF files, and numerous debug images (`debug_floor1.png`, `cv2_mask_floor1.png`). It also contains an orphaned Home Assistant configuration cache directory (`config/`). This folder is a prime target for the `/tidy` workflow to split out a dedicated `scripts/` or `tests/` directory from the static UI assets.

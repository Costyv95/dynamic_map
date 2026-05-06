# Maintenance Log

This document tracks technical debt, required refactors, and architectural issues discovered during development or automated tidying. Items listed here should be addressed in future sprints.

## 2026-05-06: Frontend Architecture Violation
**Discovered via:** `/tidy` workflow
**Affected Files:** `custom_components/dynamic_map/frontend/` (specifically ~23 `test_*.py` files and 6 data processing scripts like `dxf_processor.py`)

**Description:** 
The `frontend` directory is intended to serve static web assets (HTML, JS, compiled SVGs, images) directly through Home Assistant's static path registration. However, it currently contains numerous backend Python utilities used for DXF-to-SVG processing and OpenCV testing. This violates separation of concerns and clutters the production frontend payload.

**Suggested Action:** 
Create a new `scripts/` and `tests/` directory at the project root (`/home/costi/workspace/dynamic_map/scripts`). Migrate all Python processing utilities (`dxf_processor.py`, `render_dxf.py`, `crop.py`, etc.) and test suites out of the `frontend` folder. Ensure the frontend only contains files necessary for the `editor.html` and the `custom-svg-map.js` Lovelace card.

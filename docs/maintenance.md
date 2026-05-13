# Maintenance Log

This document tracks technical debt, required refactors, and architectural issues discovered during development or automated tidying. Items listed here should be addressed in future sprints.

## 2026-05-06: Frontend Architecture Violation
**Discovered via:** `/tidy` workflow
**Affected Files:** `custom_components/dynamic_map/frontend/token_extractor.py`

**Description:** 
The `frontend` directory is intended to serve static web assets (HTML, JS, compiled SVGs, images) directly through Home Assistant's static path registration. However, it currently contains backend Python utilities used for token extraction. This violates separation of concerns and clutters the production frontend payload.

**Status Update:** 
`dxf_processor.py` was successfully migrated to the new `server/` Microservice sidecar. `token_extractor.py` still remains.

**Suggested Action:** 
Migrate the remaining Python processing utility (`token_extractor.py`) out of the `frontend` folder into the `server/` or `scripts/` directory. Ensure the frontend only contains files necessary for the `editor.html` and the `custom-svg-map.js` Lovelace card.

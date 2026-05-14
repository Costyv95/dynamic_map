# Maintenance Log

This document tracks technical debt, required refactors, and architectural issues discovered during development or automated tidying. Items listed here should be addressed in future sprints.

## 2026-05-06: Frontend Architecture Violation
**Discovered via:** `/tidy` workflow
**Affected Files:** `custom_components/dynamic_map/frontend/token_extractor.py`

**Description:** 
The `frontend` directory is intended to serve static web assets (HTML, JS, compiled SVGs, images) directly through Home Assistant's static path registration. However, it currently contains backend Python utilities used for token extraction. This violates separation of concerns and clutters the production frontend payload.

**Status Update:** 
`dxf_processor.py` was successfully migrated to the new `server/` Microservice sidecar. `token_extractor.py` was completely removed from the project as it was no longer needed.

**Suggested Action:** 
[RESOLVED] No further python utilities remain in the frontend folder.

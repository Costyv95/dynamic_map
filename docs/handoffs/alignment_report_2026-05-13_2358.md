# Alignment Report
> Date: 2026-05-13

## Objective
Identify architectural drift between the codebase "as-built" and the core `/docs/` specifications, resolving outdated information across the documentation ecosystem.

## Discrepancies Discovered

### 1. New API Endpoint (🔴 Critical)
- **Drift:** The frontend editor heavily utilizes a `GET /api/dynamic_map/entities` endpoint to load the global Home Assistant registry for the custom autocomplete entity search. This was completely missing from `project.md`.
- **Action:** Added the endpoint specification to `project.md` to ensure the API surface area is correctly mapped.

### 2. Sidecar Architecture Implementation (🔴 Critical)
- **Drift:** `project.md` heavily implied that the HA custom component `__init__.py` handled all internal mapping mathematics. However, the system has successfully migrated to an offloaded architecture relying on the `server/api.py` microservice sidecar to prevent OpenCV from blocking the HA Event Loop.
- **Action:** Updated the Architecture section of `project.md` to formally document the `Sidecar Delegation`.

### 3. Frontend Separation of Concerns (🟡 Moderate)
- **Drift:** `maintenance.md` listed `dxf_processor.py` and `token_extractor.py` as architecture violations sitting inside the `frontend/` directory.
- **Action:** Updated the debt log to reflect that `dxf_processor.py` was successfully migrated to `server/dxf_processor.py`. `token_extractor.py` is the only remaining anomaly.

## Summary
The codebase has seen significant evolutionary shifts since the initial architecture draft, specifically offloading geometric math out of HA OS constraints, upgrading the input UI from basic HTML5 `datalist` elements to custom components, and establishing string-based mapping compatibility. The documentation is now aligned with the current "as-built" state.

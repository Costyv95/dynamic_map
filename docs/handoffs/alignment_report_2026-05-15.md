# Alignment Report

## Source Audit
Scanned `/docs/` directory. The primary technical specifications identified are:
- `project.md`: Overall Architecture and Goals.
- `shortcut_design.md`: Schema and class hierarchy for the Shortcut system.

## Discrepancies Identified (Drift)

### 🔴 Critical
- **Shortcut Schema Drift (`shortcut_design.md`)**: The documentation states `condition_entity` for state conditions, but the code actively uses `state_entity`.
- **Menu Overlay Integration**: The documentation doesn't cover the new `<ha-icon>` and `<foreignObject>` injection logic or the dynamic layout rotation decoupling added in recent sessions.

### 🟡 Moderate
- **Missing/Ghost Classes (`shortcut_design.md`)**: The documentation lists `CurtainShortcut` as a subclass example, but this class does not exist in the codebase.
- **Data Schema Enhancements**: `config.actions` now supports the `SLIDER` type which is not documented, nor is the `_expanded` folding state or `menuWidth`/`menuHeight` for the visual menu layout builder.

### 🟢 Low
- **Legacy Server Files (`project.md`)**: Still heavily references the external OpenCV Microservice sidecar. While `dxf_processor.py` exists, it runs standalone and the backend does not actively proxy to an OpenCV sidecar.

## Proposed Actions
1. Update `shortcut_design.md` schema block to reflect `state_entity`, `_expanded`, `menuWidth`, and the `SLIDER` action type.
2. Remove `CurtainShortcut` from the class list in `shortcut_design.md` and replace it with a description of the `GenericShortcut` capabilities.
3. Update `project.md` to reflect the exact state of the `server/` directory.

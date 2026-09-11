> Updated 2026-09-11 with the 4.0 unification (ADR 013).

# Dynamic Map Project Map

## Overview
A Home Assistant custom integration: an interactive SVG floorplan card plus a
visual editor. Since 4.0 the card and the editor render through the same
scene code; the editor is a native HA custom panel.

## Module topology

- **`custom_components/dynamic_map/`** - the integration package
  - `__init__.py` - views, static paths, custom panel registration.
  - `views.py` - authenticated REST API (`/api/dynamic_map/*`, writes need admin).
  - `storage.py` - filename rules, floor discovery, payload validation (tested in `tests/`).
  - `texture_gen.py` - Claude-drawn object artwork.
- **`frontend/`**
  - `custom-svg-map.js` - the Lovelace card element (composition only).
  - `dynamic-map-panel.js` - the HA custom panel element (shadow root, `hass` in).
  - `editor.html` / `editor.js` - standalone editor page and `EditorApp`.
  - **`core/`** - shared scene: `Viewport.js` (pure math), `MapScene.js` (SVG builder), `RoomStyles.js`, `Camera.js` (pointer-event viewBox camera).
  - **`shortcuts/`** - badge compositor: `MapShortcut.js`, `ShortcutLayout.js`, `ShortcutRender.js`, `ShortcutGlow.js`, `ShortcutFx.js`, `ShortcutDefs.js`, `ShortcutInteractions.js`, `ShortcutDeps.js`, `ConditionEvaluator.js`, `TemplateEvaluator.js`, `components/` renderers.
  - **`card/`** - card-only: `AmbientTint.js`, `PresenceLayer.js`, `OutsideBar.js`, `RoomFocus.js`, `CameraManager.js`, `MapBuilder.js`, `CardStyles.js`, `OverlayManager.js` + `overlay/` (per action type).
  - **`editor/`** - `EditorCanvas.js`, `EditOverlay.js`, `ToolRouter.js`, `tools/` (Shortcut / Room / Wall), `HitTest.js`, `EditorStateManager.js`, `HistoryManager.js`, `HassBridge.js`, `EditorUI.js`, `ui/` (toolbar, inspector, panels, dialogs, dom helpers).
  - **`shared/`** - `ShortcutGeometry.js` (badge frame per orientation), `OrientationProps.js`, `SensorPill.js`, `WallGeometry.js`, `ProgressBar.js`, `Color.js`, `MapGeometry.js`, `ActionRunner.js`, `ApiManager.js` (token path for the iframe, `setHass` for the panel).
  - **`tests/`** - vitest + jsdom; `EditorBoot.test.js` and `Panel.test.js` boot the real entries.
- **`server/`** - DXF/SVG sidecar (Flask + OpenCV/ezdxf).
- **`scratch/`** - `deploy.sh`, `auto_version.py`, `check_lines.sh` (300-line rule), `browser_check/` (headless Chrome harness, see its README).
- **`docs/`** - `project.md` (architecture), `history.md` (ADRs), `plan_unification.md`, `todo.md`.

## Key entry points
1. Card: `frontend/custom-svg-map.js`
2. Panel: `frontend/dynamic-map-panel.js` -> `editor.js` (`EditorApp`)
3. Backend: `custom_components/dynamic_map/__init__.py`
4. Sidecar CLI: `server/dxf_processor.py`

## Hotspots
- `shortcuts/ShortcutLayout.js` - the state > config > default precedence for every visual key; change with a test.
- `shared/ShortcutGeometry.js` - the only place that converts width/height into the stored scales.
- `editor/EditorCanvas.js#refresh` - decides between a cheap update and a full scene rebuild.

# Dynamic Map Project

## Overview
Dynamic Map is a Home Assistant custom integration that turns a floor plan
into a live, interactive SVG map with a built-in visual editor. Users draw
rooms, place device badges ("shortcuts"), decor and walls, and control the
home spatially from any dashboard, wall tablet or the Companion app.

## Architecture
Three parts share one rendering implementation.

### 1. Home Assistant integration (Python)
`custom_components/dynamic_map/`: `__init__.py` registers the HTTP views, the
static paths (`/dynamic_map_ui` for the frontend, `/dynamic_map_data` for the
data dir) and the editor as a **native custom panel** (`dynamic-map-panel`,
admin only). `views.py` holds the authenticated REST API (`/api/dynamic_map/*`;
writes need an admin), `storage.py` the HA-free filename rules and payload
validation (unit-tested in `tests/`), `texture_gen.py` the Claude texture
generation. Heavy DXF/SVG geometry runs in the optional sidecar (`server/`).

### 2. The map card (`custom:custom-svg-map`)
`frontend/custom-svg-map.js` is a thin web component. It composes:
- `core/Viewport.js` - pure auto-crop, rotation, flips and viewBox math.
- `core/MapScene.js` - builds the SVG scene (background or room plate, rooms,
  labels, walls, decor, badges) into a "scene host".
- `core/RoomStyles.js` - room fills, "on" glow, focus and selection.
- `shortcuts/` - the badge compositor: `MapShortcut.js` evaluates states and
  renders the layout built by `ShortcutLayout.js` through `ShortcutRender.js`
  and the `components/` renderers; `ShortcutGlow.js`, `ShortcutFx.js`,
  `ShortcutDefs.js`, `ShortcutInteractions.js` and `ShortcutDeps.js` carry
  the effects, defs, tap handling and the entity-dependency skip.
- `card/` - card-only features: `AmbientTint.js`, `PresenceLayer.js`,
  `OutsideBar.js`, `RoomFocus.js` (tap actions and zoom camera),
  `CameraManager.js`, `OverlayManager.js` + `overlay/*` (long-press menus).

### 3. The editor
Entry points: `dynamic-map-panel.js` (the HA panel; receives `hass`, mounts
the shell in a shadow root, API calls go through `hass.fetchWithAuth`) and
`editor.html` + `editor.js` (standalone/dev page in an HA iframe, legacy
token path). Both boot `EditorApp` from `editor.js`.
- `editor/EditorCanvas.js` mounts the **same** `core/MapScene` in an `<svg>`
  and adds `editor/EditOverlay.js` (selection box, resize/rotate handles,
  corner handles, drawing previews) in map coordinates with handle sizes
  scaled by 1/zoom. Badges are real `MapShortcut`s (`interactive = false`,
  `forcedState` for the state preview); `editor/HassBridge.js` feeds live
  state into the preview.
- `editor/ToolRouter.js` turns Pointer Events into calls on
  `tools/ShortcutTool.js`, `tools/RoomTool.js`, `tools/WallTool.js`; unclaimed
  drags pan the `core/Camera.js`.
- `editor/EditorStateManager.js` holds the floor data, selection, layers
  (rooms / objects / decor / walls) and undo (`HistoryManager.js`).
- `editor/EditorUI.js` owns `ui/Toolbar.js` and `ui/Inspector.js`; the
  inspector shows `ui/RoomPanel.js`, `ui/ShortcutPanel.js` (with
  `SizePanel`, `ActionsPanel`, `StatesPanel`, `ConditionsBuilder`,
  `VacuumPanel`), `ui/WallPanel.js` or `ui/LayerList.js`. Dialogs and toasts
  come from `ui/Dialog.js`; floor, outside-dashboard, recompute, raw-JSON and
  menu-layout dialogs live next to them. On narrow screens the inspector is a
  bottom sheet.

### Shared
`shared/ShortcutGeometry.js` is the one resolver/writer for a badge's frame
per orientation; `OrientationProps.js` the low-level oriented read/write;
`SensorPill.js`, `WallGeometry.js`, `ProgressBar.js`, `Color.js`,
`MapGeometry.js`, `ActionRunner.js`, `ApiManager.js`.

## Data
Everything lives in `<config>/dynamic_map_data/`: `rooms_floorN.json`,
`shortcuts_floorN.json`, `config_floorN.json` (rotation mode, flips,
background, walls), `bg_floorN.png`, `outside.json`, `icons/`. The schema is
unchanged by the 4.0 unification; keys starting with `_` are editor runtime
state and are never saved.

## Rules
- Every source and test file stays at or under 300 lines.
- The card and the editor never render the same thing twice: new visuals go
  into `core/` or `shortcuts/` and both pick them up.
- Verify through the real entry points (`tests/EditorBoot.test.js`,
  `tests/Panel.test.js`) and in a real browser (`scratch/browser_check/`).

## Dependencies
Home Assistant (`http`, `frontend`), PolyBool.js (room split/merge), HACS
layout. Tests: vitest + jsdom (frontend), pytest (backend).

# Plan: one renderer, one editor, one panel

Status: in progress. Branch `sess/ha_dev-unify-editor-2` (the first branch was
auto-landed on main on 2026-09-11). Started 2026-09-10.

Progress: Phase 1 done and deployed 2026-09-10. Phase 2 done, verified in a
real browser (headless Chrome on .202 against a mock backend, see
`scratch/browser_check/`) and deployed 2026-09-11. Phase 3 next.
Owner of decisions: Costi. Executor: Claude (autonomous loop).

## Why

The card (`custom-svg-map.js`, SVG DOM) and the editor (`editor.html`,
Canvas 2D via `CanvasEngine.js`) render the same JSON with two
implementations. Every shortcut feature needs a second hand-drawn canvas
copy, and ADRs 002, 003, 006, 007 and 011 are all "preview drifted from
card" fixes. The editor also runs in an iframe and steals an auth token
from the parent window, which has its own trail of fixes.

Goal: the editor renders the floor with the card's own SVG scene and adds
an editing layer on top. Then the editor becomes a Home Assistant custom
panel that receives `hass` directly. No Canvas 2D, no token hack.

## Rules for this work

- Every source and test file stays at or under 300 lines.
- Behaviour-preserving steps first, UI changes after. Tests green at every
  commit. `npm test` in `custom_components/dynamic_map/frontend`.
- Stored JSON schema does not change. Existing floors on the live box must
  load unchanged. New keys are additive only.
- No deploy to the live box (192.168.1.55) without Costi's explicit go.
- Commits in logical units on the session branch. Merge to `main` at phase
  boundaries when green.

## Target layout

```
frontend/
  custom-svg-map.js          card entry (thin)
  dynamic-map-panel.js       HA custom panel entry (Phase 4)
  editor.html / editor.js    iframe entry, kept as a dev fallback (thin)
  core/                      ONE scene implementation, used by card + editor
    Viewport.js              auto-crop, rotation, flips, viewBox math (pure)
    MapScene.js              builds the SVG scene: bg, plate, rooms, labels,
                             walls, decor, shortcuts, presence, tint
    RoomStyles.js            room fill/stroke/focus/selection styling
    FloorData.js             load/normalise/serialise floor JSON (strips
                             runtime `_` keys on save)
  shared/
    ShortcutGeometry.js      ONE resolver for a shortcut's frame per
                             orientation: {x, y, w, h, rotation, upright}
                             and ONE writer. Replaces the three resolve
                             flavours spread over OrientationProps users.
    OrientationProps.js      low-level oriented read/write (kept, smaller)
    ...existing shared modules
  shortcuts/
    MapShortcut.js           core class only (≤300)
    ShortcutLayout.js        default / sensor / state-patched layout (pure)
    ShortcutGlow.js          light pools
    ShortcutFx.js            equaliser, dust, animate()
    ShortcutDefs.js          gloss/shadow defs, tiled image pattern
    ShortcutInteractions.js  tap / long-press
    ShortcutDeps.js          entity dependency set for cheap re-render skips
  card/
    CameraManager.js         pan/zoom on a viewBox (shared with the editor)
    OverlayManager.js        split into overlay/*.js per action type
  editor/
    EditorApp.js             wiring (state, scene, overlay, tools, panels)
    EditorState.js           model + undo (existing EditorStateManager)
    EditOverlay.js           SVG editing layer: selection box, 8 handles,
                             rotation handle, vertex handles, polygon and
                             wall previews, split line. Handle size = k/zoom.
    HitTest.js               pure hit tests using ShortcutGeometry
    tools/PanZoomTool.js     default tool
    tools/ShortcutTool.js    select / drag / resize / rotate
    tools/RoomTool.js        select / vertex edit / draw / split / merge
    tools/WallTool.js        draw / drag / vertex
    ui/*.js                  sidebar panels as small modules that build DOM
                             (no editor.html markup: needed for the panel)
    editor.css               design tokens shared with the card (`--dm-*`)
```

## Phases

### Phase 1: extract, no behaviour change
1a. `shared/ShortcutGeometry.js` + tests. Wire MapShortcut, CanvasEngine,
    EditorInteractionManager, EditorUIManager to it.
1b. Split `MapShortcut.js` into the modules above. Add entity-dependency
    skip in `updateState` so a hass tick only re-renders shortcuts whose
    entities changed (card perf on tablets).
1c. Extract `core/Viewport.js` and `core/MapScene.js` from
    `custom-svg-map.js`. Card composes them. Card tests stay green.

### Phase 2: editor on SVG
2a. `editor/EditOverlay.js` + `editor/HitTest.js` + tests.
2b. Editor mounts `MapScene` in an `<svg>`; tools split from
    `EditorInteractionManager`. Pointer Events only (no touch/mouse pairs).
2c. Delete `CanvasEngine.js` and its tests; port the ones that still apply.
2d. Smoke test that boots the real `editor.js` entry (ADR 012 lesson).
    Editor preview shows live entity state via `hass`.

### Phase 3: editor UI + mobile
3a. Split `EditorUIManager` / `ShortcutConfigUI` into `editor/ui/*.js`
    modules that build their own DOM. `editor.html` becomes a shell.
3b. New layout: top toolbar (floors, layer, layout Land/Port/Linked,
    rotation, undo/redo, save), inspector on the right on wide screens,
    bottom sheet on narrow screens. Touch targets ≥ 40px. Dialogs replace
    `prompt()`/`confirm()`.
3c. Size and orientation UX: Width / Height / Rotation with a lock, the
    Land/Port/Linked switch next to those fields, a "copy to other layout"
    action, and a visible badge saying which layout is being edited.
    Stored keys stay `scaleX`/`scaleY`/`rotation`/`position` (width =
    24·scaleX map units); only the presentation changes.

### Phase 4: custom panel
4a. `dynamic-map-panel.js` custom element: gets `hass`, `narrow`, `panel`;
    mounts `EditorApp` in shadow DOM. `ApiManager` gets a transport:
    `hass.callApi` in the panel, the legacy token path only for the iframe.
4b. `__init__.py` registers `component_name="custom"` with `module_url`
    (versioned) instead of the iframe. Backend tests.
4c. PolyBool loaded as an ES module wrapper.

### Phase 5: close out
Version 4.0.0, README, `docs/project.md`, `docs/map.md`, ADR 013 in
`docs/history.md`, `docs/todo.md`. Line-count check script in `scratch/`.

## Bugs and debts found while reading (fix as they are touched)
- `_expanded` UI flags are written into the JSON files. Strip `_`-prefixed
  keys on save.
- `renderText` re-implements a subset of `TemplateEvaluator`.
- Card re-renders every shortcut's DOM on every hass tick.
- `MapShortcut.onClick` on sensors cycles readings even when a tap action
  is configured elsewhere; keep, but document.
- Editor `addFloor` uses `prompt()`/`confirm()` (broken in the companion
  app webview).
- `EditorStateManager.duplicateSelectedShortcut` strips canvas-only caches
  (`_imgCache`, `_sensorHalfW`); they disappear with the canvas.
- `custom-svg-map.js` and `CameraManager.js` bind mouse and touch events
  separately; Pointer Events cover both.

## Verification
- `npm test` (vitest, jsdom). Target: every module has a test file.
- Editor boot smoke test through the real entry point.
- Browser check with playwright-core against a static server serving the
  frontend plus `ha_test/config/dynamic_map_data` fixtures and a mocked
  `/api/dynamic_map/*` (if headless Chromium runs on this machine).
- Backend: `python3 -m pytest tests/` once pytest is available.

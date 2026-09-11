# Outstanding Tasks & Roadmap

## 1. Python Backend Hardening
- [x] **Data Validation:** Save endpoint now whitelists managed filenames and validates payload shape (`storage.py`, tested in `tests/test_storage.py`).
- [x] **Auth:** All API views require HA auth; mutating views require admin (`views.py`).
- [ ] **HA Restart Safety:** Verify if Home Assistant cache invalidation requires a specific restart hook when files in `frontend/` are overwritten by the API.
- [x] **Error Handling:** Views return standard HTTP status codes (400/403/404/413/500/502) alongside the legacy `success` body.

## 2. Frontend / Editor Polish
- [x] **Responsive Design:** the editor is a native custom panel (no iframe) with a bottom-sheet inspector and touch-sized handles on narrow screens; verified in headless Chrome at 390px inside a real HA (ADR 013).
- [ ] **Iconography:** Allow users to select different icons instead of defaulting to the hardcoded `💡` or vacuum icons.
- [x] **Shortcut Deletion Safety:** the inspector's Delete buttons confirm first (`ui/Dialog.js`); the Delete key stays immediate but undoable.
- [x] **Keyboard Delete:** `Delete`/`Backspace` removes the selected wall/object/room via a single layer-aware `EditorStateManager.deleteSelection()`; guarded against firing while typing in a form field.
- [x] **Walls Layer:** Hand-drawn architectural walls (polylines with thickness + color) stored in `config_floorN.json`; axis-snapping draw tool, vertex/body dragging, rendered as non-interactive scenery by the card.
- [x] **Room Tap Actions:** Rooms support `room_tap_action` / per-room `tap_action` (toggle, area_toggle, more-info, none) with HA-area fallback.
- [x] **Floor Auto-Discovery:** Card and editor discover floors from `/api/dynamic_map/floors`; no hardcoded floor lists.
- [x] **Dark Mode:** Card follows HA theme tokens; editor follows `prefers-color-scheme`.
- [ ] **Custom Lovelace Card:** The `custom-svg-map.js` currently requires manual YAML configuration. Build a custom Lovelace visual card editor (a `custom-svg-map-editor.js`) so users can configure the card purely via the UI instead of pasting the YAML output.
- [x] **Dual-Orientation Coordinate Maps**: Implement dynamic vertical vs. horizontal coordinate positioning arrays in `position: { horizontal: [], vertical: [] }` and program `CanvasEngine.js` and `EditorInteractionManager.js` to automatically read/write to the active layout mode.
- [x] **Generalized Declarative Shortcuts**: Implement the schema and parser for size-constraining modes (`scale_mode: "absolute" | "relative"`), generic service and payload-templated slider actions, and declarative gauge rings (`config.gauge`).

## 3. Deployment & CI/CD
- [ ] **HACS Testing:** Perform a full clean install of the repository via HACS on a secondary Home Assistant instance to verify all static paths resolve correctly.
- [ ] **Documentation:** Finalize user documentation detailing how to generate the background SVG files using the initial DXF to SVG scripts.

## 4. Open Threads (as of 2026-07-12)

- [x] **Deploy the walls render fix:** (superseded: the canvas renderer is gone, ADR 013) commit `78a2986` (whole-state forwarding, ADR 012) is pushed but **not on the box**. Until `scratch/deploy.sh` runs against `192.168.1.55`, walls are still invisible in the live editor. *Production deploys need explicit fresh authorization from Costi.*
- [ ] **Off lights don't read as off (open question, needs a live-state check):** Costi reports the office lamp shows as on in the map while physically off. In `MapShortcut.js` the crossed-out red line is hard-wired to `unavailable`/`unknown` only (lines ~349-357); a plain `off` light gets only `grayscale(55%) brightness(0.75)` (lines ~386-390) plus its glow turning off — too subtle to read as off on a lamp drawing. Two mutually exclusive root causes, not yet distinguished:
    1. HA genuinely reports the entity as `on` (state desync with the physical light, e.g. a smart bulb cut at a dumb wall switch) → the map is faithful and **no styling change helps**.
    2. HA reports `off` and the off-look is just too weak → a UI fix is warranted.
  **Next step:** read `light.desk_lamp` in HA Developer Tools → States. If (2), decide between a distinct off treatment (stronger fade/desaturation — preferred, since a red cross currently *means* "unavailable/broken") and reusing the diagonal cross for `off`. Note the floor-2 data has **no** separate "bedroom light" shortcut — the only bedroom item is `Bedroom Sensor` (`input_boolean.sensor_bedroom`); the office lamp is `Lamp desk` / `light.desk_lamp`, with no `state_entity` and no `glow` config.
- [x] **Verify through the real entry point:** `tests/EditorBoot.test.js` and `tests/Panel.test.js` boot the real entries (ADR 013). the walls bug (ADR 012) survived a green test suite because the harness fed `CanvasEngine.draw()` a hand-built state object, bypassing `editor.js draw()`. Consider a smoke test that boots the actual editor render loop so a state field dropped in wiring fails a test, not a user.

## 5. Open after the 4.0 unification (2026-09-11)

- [ ] **Compact phone toolbar:** on narrow screens the toolbar wraps to four rows; icon-only chips with labels in tooltips would save space.
- [ ] **Store width/height instead of scales:** the size panel already speaks in map units; a one-time migration of `scale*` keys to `size` would remove the 24-unit convention from the files (needs the card to read both during the transition).
- [ ] **Card camera on Pointer Events:** `card/CameraManager.js` still binds mouse and touch separately; `core/Camera.js` (used by the editor) could replace it.
- [ ] **Backend tests locally:** pytest is not installed on the dev machine; `tests/test_storage.py` runs only on the box.

## 6. After the 2026-09-11 polish pass

- [ ] **Room panel on the editor side:** show the same area device list when a room is selected, with the import button per device.
- [ ] **Quick actions in the editor:** edit `quick_actions` from the ⋯ menu instead of YAML.
- [ ] **Temperature legend:** a small scale for `room_temperature` on the card.
- [ ] **Multi-select:** shift-click several badges and move them together.

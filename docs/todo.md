# Outstanding Tasks & Roadmap

## 1. Python Backend Hardening
- [x] **Data Validation:** Save endpoint now whitelists managed filenames and validates payload shape (`storage.py`, tested in `tests/test_storage.py`).
- [x] **Auth:** All API views require HA auth; mutating views require admin (`views.py`).
- [ ] **HA Restart Safety:** Verify if Home Assistant cache invalidation requires a specific restart hook when files in `frontend/` are overwritten by the API.
- [x] **Error Handling:** Views return standard HTTP status codes (400/403/404/413/500/502) alongside the legacy `success` body.

## 2. Frontend / Editor Polish
- [ ] **Responsive Design:** Verify the iframe panel behaves correctly on mobile devices within the Home Assistant Companion App.
- [ ] **Iconography:** Allow users to select different icons instead of defaulting to the hardcoded `💡` or vacuum icons.
- [ ] **Shortcut Deletion Safety:** Add a confirmation dialog before deleting rooms or shortcuts to prevent accidental data loss. *Raised in priority by the `Delete`/`Backspace` key binding (ADR 012): destructive removal is now one keystroke away. Undo covers it, but there is no prompt.*
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

- [ ] **Deploy the walls render fix:** commit `78a2986` (whole-state forwarding, ADR 012) is pushed but **not on the box**. Until `scratch/deploy.sh` runs against `192.168.1.55`, walls are still invisible in the live editor. *Production deploys need explicit fresh authorization from Costi.*
- [ ] **Off lights don't read as off (open question, needs a live-state check):** Costi reports the office lamp shows as on in the map while physically off. In `MapShortcut.js` the crossed-out red line is hard-wired to `unavailable`/`unknown` only (lines ~349-357); a plain `off` light gets only `grayscale(55%) brightness(0.75)` (lines ~386-390) plus its glow turning off — too subtle to read as off on a lamp drawing. Two mutually exclusive root causes, not yet distinguished:
    1. HA genuinely reports the entity as `on` (state desync with the physical light, e.g. a smart bulb cut at a dumb wall switch) → the map is faithful and **no styling change helps**.
    2. HA reports `off` and the off-look is just too weak → a UI fix is warranted.
  **Next step:** read `light.desk_lamp` in HA Developer Tools → States. If (2), decide between a distinct off treatment (stronger fade/desaturation — preferred, since a red cross currently *means* "unavailable/broken") and reusing the diagonal cross for `off`. Note the floor-2 data has **no** separate "bedroom light" shortcut — the only bedroom item is `Bedroom Sensor` (`input_boolean.sensor_bedroom`); the office lamp is `Lamp desk` / `light.desk_lamp`, with no `state_entity` and no `glow` config.
- [ ] **Verify through the real entry point:** the walls bug (ADR 012) survived a green test suite because the harness fed `CanvasEngine.draw()` a hand-built state object, bypassing `editor.js draw()`. Consider a smoke test that boots the actual editor render loop so a state field dropped in wiring fails a test, not a user.

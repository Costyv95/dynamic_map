# Outstanding Tasks & Roadmap

## 1. Python Backend Hardening
- [x] **Data Validation:** Save endpoint now whitelists managed filenames and validates payload shape (`storage.py`, tested in `tests/test_storage.py`).
- [x] **Auth:** All API views require HA auth; mutating views require admin (`views.py`).
- [ ] **HA Restart Safety:** Verify if Home Assistant cache invalidation requires a specific restart hook when files in `frontend/` are overwritten by the API.
- [x] **Error Handling:** Views return standard HTTP status codes (400/403/404/413/500/502) alongside the legacy `success` body.

## 2. Frontend / Editor Polish
- [ ] **Responsive Design:** Verify the iframe panel behaves correctly on mobile devices within the Home Assistant Companion App.
- [ ] **Iconography:** Allow users to select different icons instead of defaulting to the hardcoded `💡` or vacuum icons.
- [ ] **Shortcut Deletion Safety:** Add a confirmation dialog before deleting rooms or shortcuts to prevent accidental data loss.
- [x] **Room Tap Actions:** Rooms support `room_tap_action` / per-room `tap_action` (toggle, area_toggle, more-info, none) with HA-area fallback.
- [x] **Floor Auto-Discovery:** Card and editor discover floors from `/api/dynamic_map/floors`; no hardcoded floor lists.
- [x] **Dark Mode:** Card follows HA theme tokens; editor follows `prefers-color-scheme`.
- [ ] **Custom Lovelace Card:** The `custom-svg-map.js` currently requires manual YAML configuration. Build a custom Lovelace visual card editor (a `custom-svg-map-editor.js`) so users can configure the card purely via the UI instead of pasting the YAML output.
- [x] **Dual-Orientation Coordinate Maps**: Implement dynamic vertical vs. horizontal coordinate positioning arrays in `position: { horizontal: [], vertical: [] }` and program `CanvasEngine.js` and `EditorInteractionManager.js` to automatically read/write to the active layout mode.
- [x] **Generalized Declarative Shortcuts**: Implement the schema and parser for size-constraining modes (`scale_mode: "absolute" | "relative"`), generic service and payload-templated slider actions, and declarative gauge rings (`config.gauge`).

## 3. Deployment & CI/CD
- [ ] **HACS Testing:** Perform a full clean install of the repository via HACS on a secondary Home Assistant instance to verify all static paths resolve correctly.
- [ ] **Documentation:** Finalize user documentation detailing how to generate the background SVG files using the initial DXF to SVG scripts.

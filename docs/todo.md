# Outstanding Tasks & Roadmap

## 1. Python Backend Hardening
- [ ] **Data Validation:** Implement stricter JSON schema validation in `__init__.py` before writing to the file system to prevent injection or corruption.
- [ ] **HA Restart Safety:** Verify if Home Assistant cache invalidation requires a specific restart hook when files in `frontend/` are overwritten by the API.
- [ ] **Error Handling:** Improve the error handling in `DynamicMapSaveView` to return standard HTTP status codes instead of `200 OK` with `success: false`.

## 2. Frontend / Editor Polish
- [ ] **Responsive Design:** Verify the iframe panel behaves correctly on mobile devices within the Home Assistant Companion App.
- [ ] **Iconography:** Allow users to select different icons instead of defaulting to the hardcoded `💡` or vacuum icons.
- [ ] **Shortcut Deletion Safety:** Add a confirmation dialog before deleting rooms or shortcuts to prevent accidental data loss.
- [ ] **Custom Lovelace Card:** The `custom-svg-map.js` currently requires manual YAML configuration. Build a custom Lovelace visual card editor (a `custom-svg-map-editor.js`) so users can configure the card purely via the UI instead of pasting the YAML output.

## 3. Deployment & CI/CD
- [ ] **HACS Testing:** Perform a full clean install of the repository via HACS on a secondary Home Assistant instance to verify all static paths resolve correctly.
- [ ] **Documentation:** Finalize user documentation detailing how to generate the background SVG files using the initial DXF to SVG scripts.

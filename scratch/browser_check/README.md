# Browser checks (no local Chromium needed)

Headless Chrome runs in the `aislope-chrome` container on 192.168.1.202 (CDP on
:9222). Tunnel it: `ssh -N -L 9223:192.168.176.2:9222 root@192.168.1.202`, then
run the scripts with `node` from a directory that has `playwright-core`.

* `mock_server.py` + `card.html`: serve the frontend, the fixture data from
  `ha_test/config/dynamic_map_data` and a mocked `/api/dynamic_map/*`. Copy
  `frontend/`, `data/` and these two files to `/srv/dm-test` on .202 and run
  `python3 mock_server.py 8765`. `browser_check.mjs` (card + editor
  interactions) and `ui_check.mjs` (desktop + phone screenshots) target it.
  Serve `editor.html` under `/dynamic_map_ui/` or its relative assets 404.
* `ha_e2e.mjs`: a throwaway Home Assistant (`docker run -p 8124:8123
  ghcr.io/home-assistant/home-assistant:stable` with the integration and the
  fixture data mounted in `/config`) onboarded through the REST API
  (`/api/onboarding/users` -> `/auth/token`); the script injects the tokens
  into `localStorage.hassTokens`, opens the custom panel, selects a badge and
  saves. `ha_panel_errors.mjs` dumps console errors when the panel fails.
  Use a normal Chrome user agent or HA serves its legacy ES5 bundles.

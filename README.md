# Dynamic Floorplan Map

A Home Assistant custom integration that turns your floor plan into a live, interactive SVG map — with a built-in visual editor in the HA sidebar. Draw rooms, place device shortcuts, and control your home spatially from any dashboard, wall tablet, or the companion app.

## Features

- **Interactive map card** (`custom:custom-svg-map`) — rooms light up with their entities, shortcuts show live state (lights, sensors, vacuum, media), auto-rotation fits any screen orientation, pinch/pan/zoom.
- **Native sidebar editor** — draw, split, merge and reshape room polygons; place and style shortcut objects; per-orientation layouts; undo/redo; no external tools required.
- **Room actions** — tap a room to smoothly zoom into it (making its shortcuts easy to tap), toggle its light (or all lights in its HA area), open more-info, or select rooms for vacuum segment cleaning. Configurable per card and per room.
- **Outside dashboard** — a fixed glass bar at the top of the card for outdoor data (temperature, humidity, pollen, UV, a weather entity for the forecast icon). Managed from the editor, stored in `outside.json`; unlike map shortcuts it never pans or zooms out of sight.
- **Floor management** — floors are auto-discovered from your data; add floors from a plan image or a blank canvas ("Builder Mode"), or generate rooms automatically from DXF/SVG architectural drawings via the optional sidecar. The editor's 🎨 button sets a per-floor background color (`background_color` in `config_floorN.json`) and can repaint blank-canvas floors.

> **Auto-discovery caveat:** if your card config lists `floors: [...]` explicitly, newly added floors will NOT appear until you add them there — or simply remove the `floors:` line to let the card discover floors from the backend.
- **Theme-aware** — the card follows your HA theme (light/dark); the editor follows your OS theme.

## Installation (HACS)

1. HACS → Integrations → Custom Repositories → add this repo as **Integration**.
2. Install **Dynamic Floorplan Map** and restart Home Assistant.
3. Add to `configuration.yaml`:

```yaml
dynamic_map:
  # Optional: address of the DXF/SVG processing sidecar (see server/)
  # sidecar_url: http://192.168.1.50:5000
```

4. Restart HA. A **Map Editor** entry appears in the sidebar (admin only).
5. Add the card resource (Settings → Dashboards → Resources): `/dynamic_map_ui/custom-svg-map.js` (JavaScript Module).

## Card configuration

```yaml
type: custom:custom-svg-map
# All options are optional:
default_floor: 2          # floor shown first
floors: [1, 2]            # omit to auto-discover from saved data
floor_names:              # switcher labels (default "Floor N")
  1: Ground
  2: Upstairs
room_tap_action: zoom     # zoom | toggle | area_toggle | more-info | none
vacuum_entity: vacuum.silvester
outside_bar: true         # set false to hide the outside dashboard on this card
```

**Outside dashboard**: open the editor → *🌤️ Outside Dashboard* and add items. Each item is
`{entity_id, icon?, name?, unit?, attribute?}` — weather entities automatically show a condition
icon plus the current temperature, numeric sensors show their value with the entity's (or an
overridden) unit, and tapping a chip opens the entity's more-info dialog. Items live in
`dynamic_map_data/outside.json` and apply to every floor.

`room_tap_action`:
- `zoom` (default) — animates the camera into the room so its shortcuts are large and easy to tap. Tap the room again, the room-name pill, or the background to zoom back out; pinch/wheel zooming out also releases the focus.
- `toggle` — toggles the room's configured entity; if the room has no entity but is linked to an HA area, toggles the area's lights.
- `area_toggle` — always toggles the linked HA area's lights.
- `more-info` — opens the HA more-info dialog for the room entity.
- `none` — taps are ignored.

A room can override the card-level action with its own `tap_action` (set via Raw JSON in the editor, or in `rooms_floorN.json`).

## Data files

Everything lives in `<config>/dynamic_map_data/`:

| File | Content |
|---|---|
| `rooms_floorN.json` | Room polygons (percent coordinates), names, colors, HA `area_id`/`entity_id` links |
| `shortcuts_floorN.json` | Shortcut objects: type, entity, per-orientation position/scale, states, actions |
| `config_floorN.json` | Per-floor rotation mode and flips |
| `bg_floorN.png` | Floor background image |
| `floorN.dxf` / `floorN.svg` | Optional source drawings for the sidecar pipeline |
| `icons/` | Custom icon images offered in the editor |

## The DXF/SVG sidecar (optional)

Automatic room extraction from architectural drawings runs in a separate container (OpenCV + ezdxf), typically on another machine. See `server/`:

```bash
cd server && docker compose up -d
```

Environment variables: `DYNAMIC_MAP_DATA_DIR` (default `/data/dynamic_map_data`, mount your HA config share there) and `DYNAMIC_MAP_PORT` (default 5000). Point the integration at it via `sidecar_url`.

## Security model

All `/api/dynamic_map/*` endpoints require Home Assistant authentication; write endpoints (save/delete/recompute) additionally require an **admin** user. The save endpoint only accepts the known per-floor filenames — it cannot write arbitrary files. The editor (an iframe panel) authenticates with your existing HA session; if you get an authentication error there, log in to HA with *"Keep me logged in"* checked and reload.

## Development

Frontend tests (vitest):

```bash
cd custom_components/dynamic_map/frontend
npm install
npm test
```

Backend unit tests (no HA install needed):

```bash
python -m pytest tests/
```

A disposable HA instance for manual testing is in `ha_test/` (`docker compose up`). Deployment to a live box: `scratch/deploy.sh` (stamps cache-busting versions into a temp build dir — the repo stays clean — then rsyncs and restarts HA core).

Docs: [architecture](docs/project.md) · [map card](docs/map.md) · [use cases & roadmap](docs/use_cases.md) · [sidecar](docs/server.md)

# Dynamic Floorplan Map

A Home Assistant custom integration that turns your floor plan into a live, interactive SVG map — with a built-in visual editor in the HA sidebar. Draw rooms, place device shortcuts, and control your home spatially from any dashboard, wall tablet, or the companion app.

Since 4.0 the editor renders with the card's own SVG code, so what you see while editing is exactly what the dashboard shows, and it runs as a native Home Assistant panel (no iframe) that works on phones and in the Companion app.

## Features

- **Interactive map card** (`custom:custom-svg-map`) — rooms light up with their entities, shortcuts show live state (lights, sensors, vacuum, media), auto-rotation fits any screen orientation, pinch/pan/zoom.
- **Native sidebar editor** — draw, split, merge and reshape room polygons; place and style shortcut objects; undo/redo; no external tools required. The live preview is the card itself (same SVG renderer, live entity state).
- **Editor layers** — the editor edits one layer at a time (🏠 **Rooms** / 📍 **Objects** / 🪴 **Decor** / 🧱 **Walls**); the other layers dim and stop taking clicks. Room drawing and reshaping are on while the Rooms layer is active. `Delete`/`Backspace` removes the selection (undoable); the inspector's Delete buttons ask first.
- **Two layouts, plain words** — the card shows a landscape layout on wide screens and a portrait layout on phones. In the object's *Size & position* panel choose whether edits apply to **Both layouts**, **Landscape** or **Portrait**; a *Copy* button syncs one onto the other. Width, height and rotation are in map units with an aspect lock.
- **Editor helpers** — `Shift`-click selects several objects: drag them together, align or spread them from the inspector, match their size, delete them at once. Alignment guides snap a dragged badge to other badges and room centres/edges (hold `Alt` to drag freely); arrow keys nudge the selection (`Shift` = 10 units); `Esc` clears it. A room linked to an HA area offers **Add N devices as objects**, placing badges for the area's unplaced devices. Floors can be renamed (⋯ menu). The Save button turns amber while there are unsaved changes; a local draft survives a reload and the editor offers to restore it.
- **Phone friendly** — the inspector becomes a bottom sheet on narrow screens, handles grow for touch, and the editor opens on the portrait layout when held upright.
- **Walls** — draw architectural walls as thick polylines: click ✏️ Draw Wall, click corners on the map (segments snap to horizontal/vertical within 10° — hold `Shift` for a free angle), `Enter` commits, `Esc` cancels. Drag a corner handle to reshape, drag the body to move; per-wall thickness and color. Walls are pure scenery — the card strokes them above the rooms and below decor, and they never take a tap.
- **Room panel** — tapping a room (default `zoom` action) opens a glass panel with everything in the room's Home Assistant area: lights and switches as toggles (dimmable lights get a brightness slider), covers/locks/media/vacuum buttons, a climate stepper, sensor values, an *All off* button while anything is on, a *Needs attention* list, the area's scenes and scripts as chips, and a 24-hour temperature chart with a time axis (touch or hover it to read the exact time and value). Unavailable devices are listed last without controls. On phones it is a bottom sheet that keeps the room visible above it (drag the grip to expand). Set `room_panel: false` to turn it off, `room_panel_max: 20` to show more rows.
- **All lights off** — a built-in 🌙 chip at the bottom shows how many lights are on and switches them all off after a second tap (`lights_off_button: false` hides it).
- **Quick actions** — chips at the bottom of the map, edited in the editor (⋯ → Quick actions, stored in `quick_actions.json`) or in the card config as `quick_actions:` with `{name, icon, service, data, confirm}` or the shorthand `{entity: switch.pump}` (toggle, chip lit while on). With `room_temperature` a small legend shows the colour scale.
- **Out-of-season objects hide** — with [ha_tools](https://github.com/Costyv95/ha_tools) installed, the card hides every object and quick-action chip whose entity ha_tools lists as out of position (labels such as `Cooling: On` while the Cooling dial is Off). ha_tools decides; the card subscribes to `ha_tools/hidden/subscribe`. Without ha_tools nothing is hidden, and the editor always shows everything.
- **Search** — 🔍 next to the floor chips finds any badge, room or device of a linked area across all floors. Picking a result switches the floor if needed, zooms to the badge (pulsing it) or the room, and opens the room panel.
- **Room alerts** — a badge in a room's corner counts open doors/windows (amber), leak/smoke/gas alarms (red) and robot vacuum to-dos (indigo: add water, empty the dirty tank, clean the sensors, replace brushes/filter, dock or robot errors) in its area; the robot's items land in the room of its badge (or its area, or the room its "current room" sensor names) and get a *Done* button that resets the consumable. The robot's entities are found through Home Assistant's registry (by translation key, on both the robot and its dock), so renamed entities still report their to-dos. Tap it to zoom to the room and see the list under *Needs attention*; each row opens the entity's more-info dialog. A legend chip at the bottom right explains the badges while any is visible. `room_alerts: false` turns it off; `room_alerts: {unavailable: true}` (or a list like `[open, danger, unavailable]`) also counts unavailable devices (grey).
- **Aligned robot map** — the integration republishes each Roborock map as an image entity (e.g. `image.saros_20x_home_aligned`): trimmed to the part that is actually drawn, padded out to a landscape shape so it fills a card, and carrying its own `calibration_points` and `rooms` attributes. Point the Xiaomi vacuum map card at that one entity for both the picture and the calibration and it stays aligned by itself, including after the robot re-maps your home:
  ```yaml
  type: custom:xiaomi-vacuum-map-card
  entity: vacuum.saros_20x
  vacuum_platform: Roborock
  map_source: {camera: image.saros_20x_home_aligned}
  calibration_source: {entity: image.saros_20x_home_aligned, attribute: calibration_points}
  ```
  In `configuration.yaml`, `vacuum_maps: false` turns the entities off and `vacuum_map_aspect: 1.34` pads to a different shape (`false` keeps the trimmed shape).
- **Temperature tint** — `room_temperature: true` colours every room from cool blue to warm red across `temperature_range: [16, 28]`, reading each room's `temperature_entity`, a sensor badge in the room, or the first temperature sensor of its area.
- **Room actions** — tap a room to smoothly zoom into it (making its shortcuts easy to tap), toggle its light (or all lights in its HA area), open more-info, or select rooms for vacuum segment cleaning. Configurable per card and per room.
- **Outside dashboard** — a fixed glass bar at the top of the card for outdoor data (temperature, humidity, pollen, UV, a weather entity for the forecast icon). Managed from the editor, stored in `outside.json`; unlike map shortcuts it never pans or zooms out of sight.
- **Floor management** — floors are auto-discovered from your data; add floors from a plan image or a blank canvas ("Builder Mode"), or generate rooms automatically from DXF/SVG architectural drawings via the optional sidecar. The editor's 🎨 button sets a per-floor background (`background_color` / `background_mode` in `config_floorN.json`): **fit room layout** (a rounded plate hugging the rooms — no fixed canvas, ideal for Builder-Mode floors), **repaint canvas**, or **color around the plan**.

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
  # Optional: enables the editor's "✨ Generate texture" button (Claude-drawn
  # object artwork). Two backends, first one configured wins:
  #  - a claude-agent service (headless Claude Code on your subscription,
  #    see https://github.com/Costyv95/home_net claude-agent/):
  # texture_sidecar_url: http://192.168.1.202:8098
  #  - or the paid Anthropic API. ALWAYS reference a !secret for the key:
  # anthropic_api_key: !secret anthropic_api_key
  # texture_model: claude-opus-4-8
```

4. Restart HA. A **Map Editor** entry appears in the sidebar (admin only). It is a native panel: it uses your HA session directly, also in the Companion app.
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

Any shortcut color (base, per-state, sensor pill) accepts the special value `entity` — it resolves live to the bound light's current `rgb_color`, so e.g. a bulb glows in whatever color the light is showing. A room can override the card-level action with its own `tap_action` (set via Raw JSON in the editor, or in `rooms_floorN.json`).

## Data files

Everything lives in `<config>/dynamic_map_data/`:

| File | Content |
|---|---|
| `rooms_floorN.json` | Room polygons (percent coordinates), names, colors, HA `area_id`/`entity_id` links |
| `shortcuts_floorN.json` | Shortcut objects: type, entity, per-orientation position/scale, states, actions |
| `config_floorN.json` | Per-floor rotation mode, flips, background style, and the `walls` array (polylines: `points` in percent, `thickness` in map px, `color`) |
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

Rules: every source and test file stays under 300 lines (`scratch/check_lines.sh`); new visuals go into `frontend/core/` or `frontend/shortcuts/` so the card and the editor both pick them up.

Real-browser checks (card, standalone editor, and the panel inside a throwaway Home Assistant container) are scripted in `scratch/browser_check/` — see its README. Deployment to a live box: `scratch/deploy.sh` (stamps cache-busting versions into a temp build dir — the repo stays clean — then rsyncs and restarts HA core).

Docs: [architecture](docs/project.md) · [module map](docs/map.md) · [decision records](docs/history.md) · [textures & style recipe](docs/textures.md) · [use cases & roadmap](docs/use_cases.md) · [sidecar](docs/server.md)

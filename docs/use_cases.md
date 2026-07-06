# Use Cases & Roadmap — Dynamic Floorplan Map

This document answers two questions: *what is room selection on the floormap actually for*, and *what should the map grow into as a Home Assistant surface*. It is grounded in analysis of the live deployment (HAOS at 192.168.1.55, July 2026): one panel dashboard (`Home Map`, default floor 2), 8 rooms with polygons, 16 shortcuts (10 lights, 4 sensors, 1 vacuum, 1 generic), and a device landscape of 27 lights, 11 media players, 2 covers, a Roborock vacuum, weather, calendars, presence and ~130 binary sensors.

## 1. Findings from the live deployment

- **Room→area links are mostly dangling.** The map's rooms carry `area_id`s (office, bathroom, dining_room, stairs, hallway…) but the HA area registry only defines `living_room`, `kitchen`, `bedroom`. Until the areas exist in HA *and* entities are assigned to them, area-driven features can't work. **Action: create the missing HA areas and assign entities to them — this single step unlocks most of the use cases below.**
- **Every room has an empty `entity_id`**, so tapping a room previously did nothing beyond a highlight. Room tap needs a *purpose* (now addressed via `room_tap_action`, see §2).
- **Shortcuts duplicate what areas already know.** All 10 light shortcuts are individually placed and configured; with populated areas, most of this could be derived.
- **Only the multi-select flow (vacuum room cleaning) gave rooms a real job.** That's the pattern to generalize: rooms as *spatial selectors* for services.

## 2. Room selection — use cases

### Shipped (v3.1)
| Action | Config | Behavior |
|---|---|---|
| Toggle | `room_tap_action: toggle` (default) | Toggles the room's `entity_id`; if empty, falls back to toggling all lights in the room's HA area (`light.toggle` with `area_id` target). |
| Area toggle | `room_tap_action: area_toggle` | Always targets the HA area's lights, ignoring `entity_id`. |
| More info | `room_tap_action: more-info` | Opens the native HA more-info dialog for the room entity. |
| None | `room_tap_action: none` | Selection highlight only. |
| Per-room override | `tap_action` on the room object | Any of the above, per room. |
| Vacuum multi-select | existing | Pick rooms → start segmented cleaning. |

### Next, in rough priority order
1. **Room popup ("room card")** — long-press or tap opens an overlay listing the area's entities grouped by domain: lights with brightness sliders, temperature/humidity, motion, media player transport. This turns the map into the *primary* navigation for the home, replacing per-domain dashboards. All data is already in `hass.states` + the area registry (exposed by `/api/dynamic_map/registry`).
2. **Media follow-me** — with 11 media players in the home, tapping a room could transfer Spotify/cast playback to that room's player (`media_player.join` / `spotify.transfer`). A natural `tap_action: media_transfer` with `media_entity` per room.
3. **Scene per room** — `tap_action: scene` + `scene_id`: evening scene for the living room with one tap on the wall tablet.
4. **Room-scoped announcements** — select room(s) → TTS to that room's speaker (`tts.speak` targeting the area's media player). Pairs well with the existing multi-select UI.
5. **Climate/cover control** — rooms with covers (curtain_white/curtain_yellow) or TRVs get a radial menu: open/close, set temperature.

## 3. The map as a HAOS surface — layer ideas

These exploit the fact that room polygons + HA areas give a *choropleth canvas*:

- **Comfort heatmap layer**: color rooms by temperature or humidity (sensor per area, or the shortcut's configured sensors). A toggle chip next to the floor switcher: `Lights | Temp | Humidity`.
- **Presence layer**: tint rooms with active motion/occupancy binary_sensors; fade out over N minutes. With ~130 binary sensors on the box, this is high-signal.
- **Security layer**: rooms outlined red when a door/window contact in the area is open; whole-map arm/disarm state.
- **Energy layer**: room brightness by current power draw of the area's plugs/lights.
- **Vacuum layer** (exists): dock position, live room, segmented cleaning.
- **Portal/zone integration**: rooms are natural render targets for zone-scoped orchestration (event routers per zone; capability-not-device model). The map can visualize *which zone a trigger routed to* and act as the spatial remote for zone-scoped actions.

Layers should be a first-class concept in the card config (`layers: [lights, temp, presence]`) rather than one-off hacks; `updateRoomStyles()` is already the single choke point where a layer strategy could plug in.

## 4. Platform/quality roadmap

1. **Visual card editor** (`getConfigElement`) so the card is configurable without YAML (HA standard for custom cards; also flagged in todo.md).
2. **Config flow / UI onboarding** — move from `configuration.yaml` (`dynamic_map:`) to a config entry with options (sidecar URL, default floor).
3. **Entity auto-placement** — one-click "seed shortcuts from area": for a selected room, generate light/sensor shortcuts from the area's entities at the room centroid.
4. **HACS release hygiene** — tagged releases matching `manifest.json`, README install docs, screenshots.
5. **WebSocket push in the editor** — the editor polls REST endpoints; subscribing over the HA websocket would give live state in preview.
6. **Multi-instance / guest dashboards** — a read-only mode (`room_tap_action: none` + no shortcuts actions) for wall tablets in guest areas.

## 5. Recommended next steps on the live box

1. Create HA areas for office, bathroom, dining_room, stairs, hallway; assign each room's lights/sensors to its area.
2. Set `room_tap_action: toggle` (default) — rooms immediately become light switches via the area fallback.
3. Replace the two "New Object" placeholder shortcut labels with real names.
4. Add `sidecar_url: http://192.168.1.202:5000` under `dynamic_map:` in configuration.yaml (the sidecar address is no longer baked into the integration).

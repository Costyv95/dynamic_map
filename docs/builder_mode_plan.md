# Builder Mode — Floors & Rooms (Design & Plan)

Status: **In progress** (started 2026-07-05). Author handoff from the sensor/NaN fix work.

## Motivation
Today, room polygons are produced only by the DXF→CV pipeline (`server/dxf_processor.py`
via the sidecar at `http://192.168.1.202:5000`, proxied by `DynamicMapRecomputeView`).
The editor can place **shortcuts** (lights/sensors) but treats **rooms** as mostly
read-only. There is no supported way to author a room the DXF didn't capture (e.g. a
**balcony**) or to add a floor without running the CV pipeline. Builder Mode makes
floors and rooms first-class, editable objects — no sidecar required.

## What already exists (do NOT rebuild)
- Floor selector buttons → `editor.js:loadFloor(n)` loads `bg_floor{n}.png` + `rooms_floor{n}.json` + `shortcuts_floor{n}.json`.
- An **edit mode** flag (`EditorStateManager.isEditMode`).
- **Polygon drawing**: Shift+click appends vertices to `EditorInteractionManager.drawingPolygon`; **Enter** finalizes into a room (`onKeyDown`, ~L666) as `{id, name:'New Room', polygon, color}`.
- **Room split** via `polybool` (right-click drag).
- Room selection / hit-testing (`MapGeometry.isPointInPolygon`, `state.selectedRooms`).
- Generic persistence: `POST /api/dynamic_map/save` writes any `dynamic_map_data/<file>`.
- Floor lifecycle: `DynamicMapDeleteFloorView`, `DynamicMapRecomputeView`, `DynamicMapFilesView`, `DynamicMapEntitiesView`, undo/redo via `HistoryManager`.

## Gaps
1. New rooms lack **`area_id`** → they don't bind to a HA area (no entity/room mapping).
2. No **name/color/area** UI on create; name is hardcoded `'New Room'`.
3. No **vertex editing** of an existing room's polygon (only draw-new and split).
4. Room drawing is **undiscoverable** (hidden Shift+click).
5. No way to **add a floor without DXF** (blank canvas or uploaded background image).

## Data model changes
Room object gains `area_id` (string, optional) alongside `id, name, polygon, color`.
Backward compatible — absent `area_id` behaves as today.

## Plan

### Phase 1 — Room Builder (unblocks the balcony) — IN PROGRESS
1. **Room schema + create flow**: finalized polygons open a Room panel (Name, Color, Area picker). Persist `area_id`. Area list from `GET /api/dynamic_map/entities` (or a dedicated areas source).
2. **Room edit panel**: select a room → edit name/color/area, delete room. Mirrors the shortcut config panel pattern (`EditorUIManager`).
3. **Vertex editing**: when a single room is selected in Builder Mode, render draggable vertex handles; drag to reshape, alt/right-click a vertex to delete, click an edge midpoint to insert. Writes back to `room.polygon`, routed through `HistoryManager`.
4. **Discoverability**: a visible **Builder Mode** toggle + **Add Room** button; click-to-place vertices, double-click/Enter to close (reuse `drawingPolygon`/`onKeyDown`); hint bar.
5. Validation: ≥3 vertices; ignore degenerate/self-intersecting polygons.

### Phase 2 — Floor Builder
1. **Add Floor (no DXF)**: create floor `n` from an uploaded background PNG (extend save API to accept an image → `bg_floor{n}.png`) or a blank sized canvas; seed `config_floor{n}.json`; register in the floor selector.
2. Floor rename; delete already exists.
3. DXF import stays optional; Builder Mode is the manual alternative.

### Phase 3 — Polish
Undo/redo coverage for room edits, polygon validation UX, keyboard hints, and tests
(`tests/` vitest): room create w/ area, vertex move, area binding round-trip.

## Balcony shortcut
Fastest path: **Phase 1 → a new room on the existing floor** — draw the balcony polygon,
name it "Balcony", pick its HA area, save. A separate balcony *level* would use Phase 2.

## Test / deploy
`cd custom_components/dynamic_map/frontend && npx vitest run`; deploy via `scratch/deploy.sh`
(auto-versions cache-bust, rsyncs to HA, restarts core). Keep the suite green each step.

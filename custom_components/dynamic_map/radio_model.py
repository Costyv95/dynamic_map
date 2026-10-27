"""What each Bluetooth proxy should hear anywhere on a floor (a radio map).

The proxies' spots are placed in the editor (config_floorN.json ble_proxies).
For every proxy a multi-wall path-loss model is fitted to the recorded
fingerprints:

    log10(distance Bermuda reports) = a + b * log10(map distance) + c * walls

where walls is how many room boundaries the straight line from the spot to
the proxy crosses. Live, a reading is compared with the model's prediction
on a grid over every room, giving each room a gap (RMS log10 error of its
best grid point, the same scale as position_math.feature_gap) and that
point. Rooms without fingerprints get a gap too, and the walls term is what
tells an open-plan neighbour from the room behind a wall.

Leave-one-out on the 26 floor-2 spots (2026-10-27): the room was right for
14/26 with fingerprints alone, 16/26 with the min of both gaps; median
position error 22 -> 19 map-%. HA-free (numpy only) for unit tests.
"""
import json
import math
import os
import re

import numpy as np

FAR_M = 15.0          # as position_math: a proxy that doesn't hear the phone
GRID_STEP = 1.0       # map % between grid points
LINE_SAMPLES = 40     # points along a spot->proxy line when counting walls
RIDGE = 0.01          # keeps the 3 coefficients sane with few spots
MIN_SPOTS = 6         # fingerprints a floor needs before its model is used
CONFIG_RE = re.compile(r"^config_floor(\d+)\.json$")


def read_proxies(data_dir):
    """{floor: {"aspect": h/w, "proxies": {mac: (x, y)}}} from config_floorN.json."""
    out = {}
    if not os.path.isdir(data_dir):
        return out
    for name in os.listdir(data_dir):
        m = CONFIG_RE.match(name)
        if not m:
            continue
        try:
            with open(os.path.join(data_dir, name), encoding="utf-8") as f:
                cfg = json.load(f)
        except (OSError, ValueError):
            continue
        placed = {p["id"]: tuple(p["position"]) for p in cfg.get("ble_proxies") or []
                  if isinstance(p, dict) and p.get("id") and len(p.get("position") or []) == 2}
        canvas = cfg.get("canvas") or {}
        aspect = canvas["h"] / canvas["w"] if canvas.get("w") and canvas.get("h") else 1.0
        if placed:
            out[int(m.group(1))] = {"aspect": aspect, "proxies": placed}
    return out


def room_index(pts, polygons):
    """Index into polygons of the room holding each point (-1: none); ray casting."""
    out = np.full(len(pts), -1)
    x, y = pts[:, 0][:, None], pts[:, 1][:, None]
    for k, poly in enumerate(polygons):
        xi, yi = poly[:, 0][None], poly[:, 1][None]
        xj, yj = np.roll(poly[:, 0], 1)[None], np.roll(poly[:, 1], 1)[None]
        dy = np.where(yj == yi, 1e-12, yj - yi)
        hit = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / dy + xi)
        out[(out == -1) & (hit.sum(1) % 2 == 1)] = k
    return out


def crossings(pts, pos, polygons):
    """Room-boundary changes along the line from each point to pos."""
    s = np.linspace(0.0, 1.0, LINE_SAMPLES)[None, :, None]
    line = pts[:, None, :] * (1 - s) + np.asarray(pos, float)[None, None, :] * s
    idx = room_index(line.reshape(-1, 2), polygons).reshape(len(pts), LINE_SAMPLES)
    return (np.diff(idx, axis=1) != 0).sum(1)


class FloorModel:
    def __init__(self, floor, rooms, proxies, aspect, spots):
        rooms = [r for r in rooms if len(r.get("polygon") or []) >= 3 and r.get("id")]
        polys = [np.asarray(r["polygon"], float) for r in rooms]
        axis = np.arange(GRID_STEP / 2, 100, GRID_STEP)
        grid = np.array([(x, y) for x in axis for y in axis])
        idx = room_index(grid, polys)
        self.floor, self.grid = floor, grid[idx >= 0]
        ids = np.array([rooms[i]["id"] for i in idx[idx >= 0]])
        self.members = {str(rid): np.flatnonzero(ids == rid) for rid in np.unique(ids)}
        self.macs = sorted(proxies)
        xy = np.array([(s["x"], s["y"]) for s in spots], float)
        logd = lambda s, m: math.log10(min(max(float(s["features"].get(m, FAR_M)), 0.3), FAR_M))
        cols = []
        for mac in self.macs:
            pos = proxies[mac]
            design = lambda p: np.c_[np.ones(len(p)), np.log10(np.maximum(
                np.hypot(p[:, 0] - pos[0], (p[:, 1] - pos[1]) * aspect), 1.0)), crossings(p, pos, polys)]
            a = design(xy)
            coef = np.linalg.solve(a.T @ a + RIDGE * np.eye(3), a.T @ np.array([logd(s, mac) for s in spots]))
            cols.append(np.minimum(design(self.grid) @ coef, math.log10(FAR_M)))
        self.mu = np.array(cols).T          # (grid points, proxies) predicted log10 distance

    def gaps(self, reading, skip=()):
        """{(floor, room_id): (gap, [x, y])}: each room's best grid point for this reading."""
        use = [j for j, m in enumerate(self.macs) if m not in skip]
        if not use or not len(self.grid):
            return {}
        v = np.array([math.log10(min(max(reading.get(self.macs[j], FAR_M), 0.3), FAR_M)) for j in use])
        rms = np.sqrt(((self.mu[:, use] - v) ** 2).mean(1))
        out = {}
        for rid, idx in self.members.items():
            i = idx[np.argmin(rms[idx])]
            out[(self.floor, rid)] = (float(rms[i]), [round(float(self.grid[i][0]), 2), round(float(self.grid[i][1]), 2)])
        return out


def build(rooms_by_floor, placed_by_floor, fingerprints):
    """{floor: FloorModel} for floors with placed proxies and enough spots."""
    out = {}
    for floor, placed in placed_by_floor.items():
        spots = [f for f in fingerprints if f.get("floor") == floor]
        if len(spots) >= MIN_SPOTS and rooms_by_floor.get(floor):
            out[floor] = FloorModel(floor, rooms_by_floor[floor], placed["proxies"], placed["aspect"], spots)
    return out


def house_gaps(models, reading, skip=()):
    """The gaps of every floor's model merged."""
    out = {}
    for model in models.values():
        out.update(model.gaps(reading, skip))
    return out


def refine(hit, model_hit):
    """The fingerprint estimate averaged with the model's point in the same room."""
    if model_hit is None:
        return hit
    gap, (x, y) = model_hit
    if hit is None:
        return {"x": x, "y": y, "confidence": round(max(0.0, 1.0 - gap / 0.5), 2), "gap": round(gap, 3), "used": 0}
    return {**hit, "x": round((hit["x"] + x) / 2, 2), "y": round((hit["y"] + y) / 2, 2)}

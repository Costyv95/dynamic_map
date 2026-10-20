"""Where a phone is inside a room, from Bluetooth fingerprints.

Bermuda says which room a phone is in (the room of the proxy that hears it
best). This narrows that to a spot: during calibration someone stands on a
known spot of the map and we record how far every proxy thinks the phone is
(a fingerprint). Live, the readings are compared with the fingerprints of
the room Bermuda picked, and the position is the weighted mean of the
nearest ones (k-nearest-neighbour).

Distances are compared on a log scale: a proxy reading 1 m vs 2 m is as
telling as 5 m vs 10 m, and log distance is linear in RSSI. A proxy that
does not hear the phone counts as FAR away, so "not heard" is information
too. HA-free so it can be unit-tested outside Home Assistant.
"""
import math
import statistics

FAR_M = 15.0          # a proxy that doesn't hear the phone reads as this far
NEAR_M = 0.3          # readings below this are noise
K = 3                 # neighbours averaged


def clamp_distance(d):
    """A usable distance in metres, or None for a reading that isn't one."""
    try:
        d = float(d)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(d) or d < 0:
        return None
    return min(max(d, NEAR_M), FAR_M)


def feature_gap(a, b):
    """Distance between two readings {scanner: metres}, on a log scale.

    Taken over every scanner either side heard; a scanner one side did not
    hear reads FAR_M. Root-mean-square, so more proxies don't inflate it.
    """
    keys = set(a) | set(b)
    if not keys:
        return float("inf")
    total = 0.0
    for k in keys:
        da = math.log10(a.get(k, FAR_M))
        db = math.log10(b.get(k, FAR_M))
        total += (da - db) ** 2
    return math.sqrt(total / len(keys))


def median_reading(samples):
    """One fingerprint from a list of readings: the per-scanner median.

    A scanner counts only if it heard the phone in at least half the samples,
    so a proxy that caught one stray packet doesn't define the spot.
    """
    if not samples:
        return {}
    heard = {}
    for s in samples:
        for k, v in s.items():
            heard.setdefault(k, []).append(v)
    need = max(1, math.ceil(len(samples) / 2))
    return {k: round(statistics.median(v), 2) for k, v in heard.items() if len(v) >= need}


def estimate(fingerprints, reading, k=K):
    """Weighted k-nearest-neighbour position.

    fingerprints: [{x, y, features}], all from the one room being searched.
    Returns {x, y, confidence, gap, used} or None when nothing to compare.
    confidence is 1 for a reading identical to a fingerprint and falls
    toward 0 as the nearest gap grows to ~0.5 decades (a factor of 3 in
    distance on every proxy).
    """
    if not fingerprints or not reading:
        return None
    ranked = sorted(
        ((feature_gap(fp["features"], reading), fp) for fp in fingerprints),
        key=lambda t: t[0],
    )[: max(1, k)]
    weights = [1.0 / (gap + 0.02) for gap, _ in ranked]
    total = sum(weights)
    x = sum(w * fp["x"] for w, (_, fp) in zip(weights, ranked)) / total
    y = sum(w * fp["y"] for w, (_, fp) in zip(weights, ranked)) / total
    best = ranked[0][0]
    return {
        "x": round(x, 2),
        "y": round(y, 2),
        "confidence": round(max(0.0, 1.0 - best / 0.5), 2),
        "gap": round(best, 3),
        "used": len(ranked),
    }


def smooth(prev, new, alpha=0.4):
    """Glide from the previous position toward the new one."""
    if not prev:
        return new
    return {**new, "x": round(prev["x"] + (new["x"] - prev["x"]) * alpha, 2),
            "y": round(prev["y"] + (new["y"] - prev["y"]) * alpha, 2)}


# --- rooms -------------------------------------------------------------------

def point_in_polygon(x, y, polygon):
    """Ray casting; polygon is [[x, y], ...] in map percent."""
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i][0], polygon[i][1]
        xj, yj = polygon[j][0], polygon[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def polygon_centre(polygon):
    """Area centroid (falls back to the vertex mean for a degenerate shape)."""
    a = cx = cy = 0.0
    n = len(polygon)
    for i in range(n):
        x0, y0 = polygon[i][0], polygon[i][1]
        x1, y1 = polygon[(i + 1) % n][0], polygon[(i + 1) % n][1]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(a) < 1e-9:
        return [round(sum(p[0] for p in polygon) / n, 2), round(sum(p[1] for p in polygon) / n, 2)]
    a *= 0.5
    return [round(cx / (6 * a), 2), round(cy / (6 * a), 2)]


def room_at(rooms_by_floor, floor, x, y):
    """The room on `floor` containing the point, or None."""
    for room in rooms_by_floor.get(floor, []):
        poly = room.get("polygon") or []
        if len(poly) >= 3 and point_in_polygon(x, y, poly):
            return room
    return None


def room_for_area(rooms_by_floor, area, area_names=None):
    """(floor, room) for a Bermuda area: matched by area id, room name or area name."""
    s = (area or "").strip().lower()
    if not s or s in ("unknown", "unavailable", "not_home", "away", "none"):
        return None, None
    names = {k: (v or "").strip().lower() for k, v in (area_names or {}).items()}
    for match in (
        lambda r: (r.get("area_id") or "").lower() == s,
        lambda r: (r.get("name") or "").strip().lower() == s,
        lambda r: names.get(r.get("area_id") or "") == s,
    ):
        for floor in sorted(rooms_by_floor):
            for room in rooms_by_floor[floor]:
                if match(room):
                    return floor, room
    return None, None

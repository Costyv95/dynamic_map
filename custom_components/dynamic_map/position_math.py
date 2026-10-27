"""Where a phone is inside a room, from Bluetooth fingerprints.

Bermuda says which room a phone is in (the room of the proxy that hears it
best). This narrows that to a spot: during calibration someone stands on a
known spot of the map and we record how far every proxy thinks the phone is
(a fingerprint). Live, the readings are compared with the fingerprints of
the room Bermuda picked, and the position is the weighted mean of the
nearest ones (k-nearest-neighbour).

Live readings jitter, so one reading never decides anything on its own
(Track): readings are pooled per proxy over the last few seconds, each
room's match is averaged over time and another room has to match clearly
better before the dot changes room, and inside a room the dot glides
toward the estimate no faster than a person walks. A phone no proxy hears
at all (locked and quiet, or gone out) stays where it was last placed.

Distances are compared on a log scale: a proxy reading 1 m vs 2 m is as
telling as 5 m vs 10 m, and log distance is linear in RSSI. A proxy that
does not hear the phone counts as FAR away, so "not heard" is information
too. The best-matching spots over the whole house pick the floor and room
(room_gaps), with Bermuda's room only as the fallback. HA-free so
it can be unit-tested outside Home Assistant.
"""
import math
import statistics

FAR_M = 15.0          # a proxy that doesn't hear the phone reads as this far
NEAR_M = 0.3          # readings below this are noise
K = 3                 # neighbours averaged
KERNEL_TAU = 0.05     # log10 gap over which a neighbour's weight falls by e
MATCH_GAP = 0.3       # a best match closer than this (log10 RMS) beats Bermuda's room
WINDOW_S = 3.0        # live readings pooled per proxy before matching
ROOM_TAU_S = 4.0      # how long a room's match is remembered (time constant)
ROOM_MARGIN = 0.01    # another room's mean squared gap must be this much lower to take over
POS_TAU_S = 2.5       # the dot covers 63% of the way to a new estimate in this long
MAX_SPEED = 12.0      # map % per second the dot may move inside a room (walking pace)
RESET_S = 60.0        # after this long without an update the track starts afresh


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
        return 0.0     # neither side heard by any proxy: the same silence
    total = 0.0
    for k in keys:
        da = math.log10(a.get(k, FAR_M))
        db = math.log10(b.get(k, FAR_M))
        total += (da - db) ** 2
    return math.sqrt(total / len(keys))


def drop_scanners(fingerprints, scanners):
    """The fingerprints with these proxies left out of every spot.

    An offline proxy hears nobody, so live it would read FAR for every phone
    and every spot it heard up close would stop matching; its silence says
    nothing about where the phone is.
    """
    if not scanners:
        return fingerprints
    return [
        {**fp, "features": {k: v for k, v in fp["features"].items() if k not in scanners}}
        for fp in fingerprints
    ]


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
    if not fingerprints:
        return None
    ranked = sorted(
        ((feature_gap(fp["features"], reading), fp) for fp in fingerprints),
        key=lambda t: t[0],
    )[: max(1, k)]
    # Weights relative to the best match: a spot KERNEL_TAU worse counts 1/e as
    # much. Smooth in the reading, so the estimate slides between spots
    # instead of snapping to whichever is nearest.
    weights = [math.exp(-(gap - ranked[0][0]) / KERNEL_TAU) for gap, _ in ranked]
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


def room_gaps(fingerprints, reading, bermuda_room=None, match_gap=MATCH_GAP):
    """{(floor, room_id): gap of its best-matching spot} for this reading.

    Bermuda's room counts as matching at match_gap even without spots of its
    own, so a good fingerprint match beats Bermuda and a poor one defers to it.
    """
    gaps = {}
    for fp in fingerprints:
        key = (fp["floor"], fp["room_id"])
        g = feature_gap(fp["features"], reading)
        if g < gaps.get(key, math.inf):
            gaps[key] = g
    if bermuda_room and bermuda_room[1] is not None:
        key = tuple(bermuda_room)
        gaps[key] = min(gaps.get(key, math.inf), match_gap)
    return gaps


def pooled(history, now, window=WINDOW_S):
    """One reading from the last `window` seconds of (stamp, reading) pairs."""
    return median_reading([r for t, r in history if now - t <= window])


class Track:
    """One phone's position over time: pooled readings, a sticky room, a glide.

    step() takes the latest reading and returns (floor, room_id, estimate);
    estimate is None when the room has no spots (the caller centres the dot).
    """

    def __init__(self):
        self.history = []        # [(stamp, reading)] within WINDOW_S
        self.scores = {}         # {(floor, room_id): time-averaged squared gap}
        self.seen = {}           # {(floor, room_id): last stamp it was a candidate}
        self.room = None
        self.pos = None          # {"x", "y"} last output inside self.room
        self.stamp = None
        self.last = None         # the last step's result, held while the phone is unheard

    def step(self, fingerprints, reading, now, bermuda_room=None):
        if not reading:
            # No proxy hears the phone: it's locked and quiet, or out of the
            # house. Either way nothing new is known, so it stays where it was
            # last placed (None if it never was).
            return self.last
        if self.stamp is not None and now - self.stamp > RESET_S:
            self.__init__()
        dt = 1.0 if self.stamp is None else max(0.0, now - self.stamp)
        first = self.stamp is None
        self.stamp = now
        self.history = [(t, r) for t, r in self.history if now - t <= WINDOW_S] + [(now, reading)]
        live = pooled(self.history, now)

        gaps = room_gaps(fingerprints, live, bermuda_room)
        if not gaps:
            self.room = self.pos = None
            return self.last
        # Each room's squared gap, averaged over ROOM_TAU_S; a room that drops out
        # of the candidates is remembered as matching at FAR (gap 1 decade).
        # A room new to the average starts there at FAR too, and one missing for
        # less than ROOM_TAU_S (a Bermuda blip) holds its score (#1740).
        keep = 0.0 if first else math.exp(-dt / ROOM_TAU_S)
        self.seen.update((key, now) for key in gaps)
        for key in set(self.scores) | set(gaps):
            if key not in gaps and key in self.scores and now - self.seen.get(key, now) < ROOM_TAU_S:
                continue
            g2 = min(gaps.get(key, 1.0), 1.0) ** 2
            self.scores[key] = keep * self.scores.get(key, 1.0) + (1 - keep) * g2
            if key not in gaps and self.scores[key] > 0.9 and key != self.room:
                del self.scores[key]      # long forgotten (an old Bermuda room)
                self.seen.pop(key, None)
        best = min(self.scores, key=self.scores.get)
        if self.room not in self.scores or self.scores[best] < self.scores[self.room] - ROOM_MARGIN:
            if best != self.room:
                self.pos = None
            self.room = best
        floor, room_id = self.room
        spots = [fp for fp in fingerprints if fp["floor"] == floor and fp["room_id"] == room_id]
        hit = estimate(spots, live)
        if hit is None:
            self.pos = None
            self.last = (floor, room_id, None)
        else:
            self.pos = glide(self.pos, hit, dt)
            self.last = (floor, room_id, {**hit, "x": self.pos["x"], "y": self.pos["y"]})
        return self.last


def glide(prev, new, dt, tau=POS_TAU_S, max_speed=MAX_SPEED):
    """Move from prev toward new: a share 1 - e^(-dt/tau) of the way, at most max_speed * dt."""
    if not prev:
        return {"x": new["x"], "y": new["y"]}
    dx, dy = new["x"] - prev["x"], new["y"] - prev["y"]
    share = 1.0 - math.exp(-dt / tau)
    step = math.hypot(dx, dy) * share
    if step > max_speed * dt:
        share *= max_speed * dt / step
    return {"x": round(prev["x"] + dx * share, 2), "y": round(prev["y"] + dy * share, 2)}


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


NOWHERE = ("unknown", "unavailable", "not_home", "away", "none", "off")


def room_for_area(rooms_by_floor, area, area_names=None):
    """(floor, room) for a Bermuda area: matched by area id, room name or area name.

    Each rule is tried on every floor in number order before the next rule.
    The card's PresenceLayer.roomForState uses the same order and NOWHERE set;
    both suites run frontend/tests/fixtures/area_room_cases.json (#1708).
    """
    s = (area or "").strip().lower()
    if not s or s in NOWHERE:
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

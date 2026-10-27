"""Calibration spots against the current map, and Bermuda ids (#1740).

HA-free, so the tests load it by path like position_math.py.
"""
import re

MAC_RE = re.compile(r"[0-9a-f]{2}(?::[0-9a-f]{2}){5}", re.I)


def proxy_mac(unique_id):
    """The proxy's MAC in a Bermuda per-proxy distance sensor's unique_id, or None.

    The uid is `<device id>_<proxy mac>_range`. A device id can itself be a MAC
    (a tracker that doesn't rotate its address), so the proxy is the last MAC.
    """
    found = MAC_RE.findall(unique_id or "")
    return found[-1].lower() if found else None


def live_spots(fingerprints, rooms_by_floor, room_at):
    """The spots that still belong to a room on the map.

    A spot of a room that was split or redrawn moves to the room now holding
    its point, and one whose point is in no room is left out, so a deleted
    room can never win the match. Stored spots are not changed.
    room_at(rooms_by_floor, floor, x, y) -> room dict or None.
    """
    ids = {(f, r.get("id")) for f, rooms in rooms_by_floor.items() for r in rooms}
    out = []
    for fp in fingerprints:
        if (fp["floor"], fp["room_id"]) in ids:
            out.append(fp)
            continue
        room = room_at(rooms_by_floor, fp["floor"], fp["x"], fp["y"])
        if room is not None:
            out.append({**fp, "room_id": room.get("id"), "room": room.get("name")})
    return out

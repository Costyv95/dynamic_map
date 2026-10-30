"""Vacuum cleaning schedules, without Home Assistant: validate, due, plan.

A schedule cleans some rooms (none = the whole house) of one vacuum at a
time of day on chosen weekdays. vacuum_schedules.py stores them, runs the
minute tick and turns a plan into service calls.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta

MODES = ("vac_mop", "vacuum", "mop")
TIME = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
FIELDS = ("name", "enabled", "entity_id", "time", "days", "rooms",
          "mode", "suction", "water", "route", "repeat")


def normalize(data: dict, existing: dict | None = None) -> dict:
    """A complete, valid schedule from new fields over an existing one.

    Raises ValueError naming the first bad field.
    """
    s = dict(existing or {})
    s.update({k: v for k, v in data.items() if k in FIELDS and v is not None})
    s.setdefault("id", data.get("id") or uuid.uuid4().hex[:12])
    s.setdefault("enabled", True)
    s.setdefault("rooms", [])
    s.setdefault("mode", "vac_mop")
    s.setdefault("repeat", 1)
    if not str(s.get("entity_id", "")).startswith("vacuum."):
        raise ValueError("entity_id must be a vacuum")
    if not TIME.match(str(s.get("time", ""))):
        raise ValueError("time must be HH:MM")
    days = sorted({int(d) for d in s.get("days") or []})
    if not days or any(d < 0 or d > 6 for d in days):
        raise ValueError("days must be weekdays 0 (Monday) to 6 (Sunday)")
    if s["mode"] not in MODES:
        raise ValueError(f"mode must be one of {', '.join(MODES)}")
    repeat = int(s["repeat"])
    if not 1 <= repeat <= 3:
        raise ValueError("repeat must be 1 to 3")
    s.update(days=days, repeat=repeat, enabled=bool(s["enabled"]),
             rooms=[str(r) for r in s["rooms"]], name=str(s.get("name") or "").strip())
    for key in ("suction", "water", "route"):
        if not s.get(key):
            s.pop(key, None)
    return s


def is_due(s: dict, now: datetime) -> bool:
    """True in the schedule's minute, once: last_run guards a repeated tick."""
    if not s.get("enabled") or now.weekday() not in s["days"]:
        return False
    if now.strftime("%H:%M") != s["time"]:
        return False
    return s.get("last_run", "")[:16] != now.strftime("%Y-%m-%dT%H:%M")


def next_run(s: dict, now: datetime) -> datetime | None:
    """The next start after `now` for an enabled schedule."""
    if not s.get("enabled"):
        return None
    hour, minute = map(int, s["time"].split(":"))
    for ahead in range(8):
        day = now + timedelta(days=ahead)
        at = day.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if at > now and at.weekday() in s["days"]:
            return at
    return None


def segments_for(rooms: list[str], room_names: dict[int, str]) -> list[int]:
    """Segment ids for room names (case-insensitive); unknown names are dropped."""
    by_name = {name.casefold(): seg for seg, name in room_names.items()}
    return [by_name[r.casefold()] for r in rooms if r.casefold() in by_name]


def plan(s: dict, selects: dict[str, str], room_names: dict[int, str]) -> list[tuple]:
    """Service calls, in order, that carry out one run of a schedule.

    `selects` maps the vacuum's select kinds (cleaning_mode, mop_intensity,
    mop_mode) to their entity ids. Raises ValueError if none of the chosen
    rooms is known to the robot, rather than cleaning the whole house.
    """
    vac = s["entity_id"]
    steps: list[tuple] = []

    def choose(kind: str, option: str):
        if kind in selects and option:
            steps.append(("select", "select_option", {"entity_id": selects[kind], "option": option}))

    choose("cleaning_mode", {"vac_mop": "vac_and_mop"}.get(s["mode"], s["mode"]))
    if s["mode"] != "mop" and s.get("suction"):
        steps.append(("vacuum", "set_fan_speed", {"entity_id": vac, "fan_speed": s["suction"]}))
    if s["mode"] != "vacuum":
        choose("mop_intensity", s.get("water"))
        choose("mop_mode", s.get("route"))
    segments = segments_for(s["rooms"], room_names)
    if s["rooms"] and not segments:
        raise ValueError(f"none of {', '.join(s['rooms'])} is a room of {vac}")
    if not segments and s["repeat"] > 1:
        segments = sorted(room_names)
    if segments:
        steps.append(("vacuum", "send_command", {
            "entity_id": vac, "command": "app_segment_clean",
            "params": [{"segments": segments, "repeat": s["repeat"]}]}))
    else:
        steps.append(("vacuum", "start", {"entity_id": vac}))
    return steps

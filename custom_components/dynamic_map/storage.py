"""Filesystem naming rules and helpers for Dynamic Map data files.

This module is deliberately free of Home Assistant imports so it can be
unit-tested outside a HA environment.
"""
import json
import os
import re
import shutil
import tempfile
import threading

# Floors are drawn (config_floorN.json carries the canvas, walls and plate);
# a bg_floorN.png left from a scanned floor is still found, shown and deleted
# with its floor, but never written.
# Managed data files: per-floor sets plus the global outside-dashboard and quick-actions configs.
# The save endpoint only accepts these names so the HTTP API can never be
# used to write arbitrary files into the config dir.
ALLOWED_SAVE_RE = re.compile(r"^(?:(?:rooms|shortcuts|config)_floor\d+\.json|outside\.json|quick_actions\.json)$")
FLOOR_NUM_RE = re.compile(r"^(?:rooms|shortcuts|config|bg)_floor(\d+)\.(?:json|png)$")

ICON_EXTENSIONS = (".png", ".jpg", ".jpeg", ".svg", ".webp")

# Global list files the card asks for on every load. They are optional, so a
# fresh install has none and every load logs a 404 in the browser console.
# Creating them empty keeps the console clean and changes nothing else.
GLOBAL_LIST_FILES = ("outside.json", "quick_actions.json")


def is_allowed_data_filename(filename):
    """Return True if filename is one of the per-floor data files we manage."""
    return bool(filename) and bool(ALLOWED_SAVE_RE.match(filename))


def floor_filenames(floor_num):
    """All data files that make up one floor; [] unless floor_num is a number."""
    if not str(floor_num).isdigit():
        return []
    return [
        f"rooms_floor{floor_num}.json",
        f"shortcuts_floor{floor_num}.json",
        f"config_floor{floor_num}.json",
        f"bg_floor{floor_num}.png",
    ]


def discover_floors(data_dir):
    """Scan the data dir and return sorted floor numbers that have any data file."""
    floors = set()
    if not os.path.isdir(data_dir):
        return []
    for name in os.listdir(data_dir):
        match = FLOOR_NUM_RE.match(name)
        if match:
            floors.add(int(match.group(1)))
    return sorted(floors)


def list_icons(data_dir, url_base):
    """List custom icon URLs under the data dir's icons/ folder."""
    icons_dir = os.path.join(data_dir, "icons")
    if not os.path.isdir(icons_dir):
        return []
    return sorted(
        f"{url_base}/icons/{f}"
        for f in os.listdir(icons_dir)
        if f.lower().endswith(ICON_EXTENSIONS)
    )


def validate_save_content(filename, content):
    """Light structural validation of JSON payloads before they hit disk.

    Rooms, shortcuts and outside items are lists of objects; per-floor
    config is an object. Kept intentionally lenient so schema evolution
    doesn't require a lockstep backend change.
    """
    if filename.startswith(("rooms_", "shortcuts_")) or filename in ("outside.json", "quick_actions.json"):
        return isinstance(content, list) and all(isinstance(item, dict) for item in content)
    if filename.startswith("config_"):
        return isinstance(content, dict)
    return False


_path_locks = {}
_path_locks_guard = threading.Lock()


def _lock_for(path):
    with _path_locks_guard:
        return _path_locks.setdefault(os.path.abspath(path), threading.Lock())


def write_json_atomic(path, content):
    """Write content as JSON to path without ever leaving it half-written.

    The JSON goes to a temp file of its own in the same directory, is fsynced,
    and then os.replace()s the old file, so a crash or full disk mid-write
    leaves the previous version in place. The previous version is also kept as
    ``<name>.bak``, one save deep, because config_floorN.json is the only copy
    of a hand-drawn floor. Saves of one path run one at a time (#1739): two
    editor tabs saving together each finish whole, the later one wins.
    """
    with _lock_for(path):
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path) or ".",
                                        prefix=os.path.basename(path) + ".", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(content, handle, ensure_ascii=False, indent=2)
                handle.flush()
                os.fsync(handle.fileno())
            os.chmod(tmp_path, 0o644)   # mkstemp makes 0600; the data dir is served read-only
            if os.path.exists(path):
                shutil.copy2(path, f"{path}.bak")
            os.replace(tmp_path, path)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


def ensure_global_lists(data_dir):
    """Create any missing global list file as an empty list.

    Returns the names created, so start-up can say what it did.
    """
    created = []
    for name in GLOBAL_LIST_FILES:
        path = os.path.join(data_dir, name)
        if os.path.exists(path):
            continue
        try:
            with open(path, "w", encoding="utf-8") as handle:
                json.dump([], handle)
        except OSError:
            continue
        created.append(name)
    return created


def floor_names(data_dir):
    """Map floor number -> name from each config_floorN.json that has one."""
    names = {}
    for floor in discover_floors(data_dir):
        path = os.path.join(data_dir, f"config_floor{floor}.json")
        try:
            with open(path, encoding="utf-8") as fh:
                name = json.load(fh).get("name")
        except (OSError, ValueError, AttributeError):
            continue
        if isinstance(name, str) and name.strip():
            names[floor] = name.strip()
    return names

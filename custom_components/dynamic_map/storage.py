"""Filesystem naming rules and helpers for Dynamic Map data files.

This module is deliberately free of Home Assistant imports so it can be
unit-tested outside a HA environment.
"""
import os
import re

# Per-floor data files. The save endpoint only accepts these names so the
# HTTP API can never be used to write arbitrary files into the config dir.
ALLOWED_SAVE_RE = re.compile(r"^(?:(?:rooms|shortcuts|config)_floor\d+\.json|bg_floor\d+\.png)$")
FLOOR_NUM_RE = re.compile(r"^(?:rooms|shortcuts|config|bg)_floor(\d+)\.(?:json|png)$")

ICON_EXTENSIONS = (".png", ".jpg", ".jpeg", ".svg", ".webp")
SOURCE_EXTENSIONS = (".dxf", ".svg")

# Maximum accepted size for an uploaded floor background (decoded bytes).
MAX_BACKGROUND_BYTES = 20 * 1024 * 1024


def is_allowed_data_filename(filename):
    """Return True if filename is one of the per-floor data files we manage."""
    return bool(filename) and bool(ALLOWED_SAVE_RE.match(filename))


def floor_filenames(floor_num):
    """All data files that make up one floor."""
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


def list_source_files(data_dir):
    """List DXF/SVG source files available for recompute."""
    if not os.path.isdir(data_dir):
        return []
    return sorted(f for f in os.listdir(data_dir) if f.lower().endswith(SOURCE_EXTENSIONS))


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

    Rooms and shortcuts are lists of objects; per-floor config is an object.
    Kept intentionally lenient so schema evolution doesn't require a
    lockstep backend change.
    """
    if filename.startswith(("rooms_", "shortcuts_")):
        return isinstance(content, list) and all(isinstance(item, dict) for item in content)
    if filename.startswith("config_"):
        return isinstance(content, dict)
    return False

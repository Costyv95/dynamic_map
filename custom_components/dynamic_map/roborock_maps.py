"""Bridge to the Roborock integration's live map.

We read the PNG the Roborock integration has already rendered together with
the map geometry it parsed, so the calibration we publish always describes
the very image we publish. Every read is wrapped: if Roborock reshuffles
its internals, this bridge goes quiet instead of breaking the map.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .vacuum_map import Reference

_LOGGER = logging.getLogger(__name__)

ROBOROCK = "roborock"

REFERENCE_POINTS = ((25500, 25500), (35500, 25500), (25500, 35500))
"""Three points in the robot's millimetre grid, far apart and not collinear."""


@dataclass
class RobotMap:
    """One saved map of one robot."""

    duid: str
    flag: int
    robot: str
    map_name: str
    coordinator: Any

    @property
    def key(self) -> str:
        """A stable id for this robot's map, safe to use in a unique_id."""
        return f"{self.duid}_{self.flag}".lower()


@dataclass
class Snapshot:
    """The robot's map as it stands right now."""

    image: bytes
    references: list[Reference]
    rooms: dict[str, dict] = field(default_factory=dict)
    updated: datetime | None = None


def _home(coordinator: Any) -> Any:
    return coordinator.properties_api.home


def _room_names(coordinator: Any, flag: int) -> dict[int, str]:
    """Segment id to room name, as the robot's app has them."""
    names: dict[int, str] = {}
    try:
        info = (_home(coordinator).home_map_info or {}).get(flag)
        for room in getattr(info, "rooms", None) or []:
            label = getattr(room, "name", None) or getattr(room, "raw_name", None)
            segment = getattr(room, "segment_id", None)
            if label and segment is not None:
                names[int(segment)] = str(label)
    except Exception as err:  # another integration's internals
        _LOGGER.debug("No Roborock room names: %s", err)
    return names


def discover(hass: Any) -> list[RobotMap]:
    """Every robot map the loaded Roborock entries can currently offer."""
    maps: list[RobotMap] = []
    for entry in hass.config_entries.async_entries(ROBOROCK):
        for coordinator in getattr(getattr(entry, "runtime_data", None), "v1", None) or []:
            try:
                content = _home(coordinator).home_map_content or {}
                info = _home(coordinator).home_map_info or {}
                robot = (coordinator.device_info or {}).get("name") or coordinator.duid_slug
                duid = coordinator.duid
            except Exception as err:  # another integration's internals
                _LOGGER.debug("Roborock coordinator not readable: %s", err)
                continue
            for flag in content:
                name = getattr(info.get(flag), "name", None) or f"Map {flag}"
                maps.append(RobotMap(duid, int(flag), str(robot), str(name), coordinator))
    return maps


def snapshot(robot: RobotMap) -> Snapshot | None:
    """The rendered map plus its calibration references, or None."""
    try:
        from vacuum_map_parser_base.map_data import Point

        content = (_home(robot.coordinator).home_map_content or {}).get(robot.flag)
        image = content.image_content
        data = content.map_data
        dimensions = data.image.dimensions
        references = []
        for x, y in REFERENCE_POINTS:
            point = dimensions.to_img(Point(x, y))
            references.append(Reference(x, y, float(point.x), float(point.y)))
        names = _room_names(robot.coordinator, robot.flag)
        rooms = {}
        for number, room in (data.rooms or {}).items():
            box = {"x0": room.x0, "y0": room.y0, "x1": room.x1, "y1": room.y1}
            if name := names.get(int(number)):
                box["name"] = name
            rooms[str(number)] = box
    except Exception as err:  # another integration's internals
        _LOGGER.debug("No usable Roborock map for %s: %s", robot.key, err)
        return None
    if not image or len(references) < 3:
        return None
    return Snapshot(
        image, references, rooms, getattr(robot.coordinator, "last_home_update", None)
    )

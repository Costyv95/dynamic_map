"""An image entity that serves a robot's map ready for a map card.

The Roborock integration draws its map on a canvas far larger than the
explored home, and the calibration a card needs shifts every time the robot
re-maps. This entity republishes the same map trimmed to what is drawn,
padded out to a landscape shape so it fills a card, and carries the
matching calibration in its `calibration_points` attribute. Point the
Xiaomi vacuum map card at this entity for both and it stays aligned by
itself.
"""
from __future__ import annotations

import logging

from homeassistant.components.image import ImageEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from . import roborock_maps
from .const import DOMAIN
from .vacuum_map import calibration_points, fit

_LOGGER = logging.getLogger(__name__)

DEFAULT_ASPECT = 1.5
DEFAULT_MARGIN = 0.02


async def async_setup_platform(
    hass: HomeAssistant,
    config: dict,
    async_add_entities: AddEntitiesCallback,
    discovery_info: dict | None = None,
) -> None:
    """Set up one aligned map entity per robot map found at start-up."""
    info = discovery_info or {}
    maps = info.get("maps") or roborock_maps.discover(hass)
    aspect = info.get("aspect", DEFAULT_ASPECT)
    entities = [AlignedVacuumMap(hass, robot, aspect) for robot in maps]
    if entities:
        async_add_entities(entities)
        _LOGGER.info("Dynamic Map: serving %d aligned vacuum map(s)", len(entities))


class AlignedVacuumMap(ImageEntity):
    """A robot map, trimmed and calibrated for a map card."""

    _attr_content_type = "image/png"
    _attr_should_poll = False

    def __init__(
        self, hass: HomeAssistant, robot: roborock_maps.RobotMap, aspect: float | None
    ) -> None:
        """Wrap one robot map."""
        super().__init__(hass)
        self._robot = robot
        self._aspect = aspect
        self._attr_unique_id = f"{DOMAIN}_aligned_map_{robot.key}"
        self._attr_name = f"{robot.robot} {robot.map_name} aligned"
        self._image: bytes | None = None
        self._source: bytes | None = None
        self._points: list[dict] = []
        self._rooms: dict[int, list[int]] = {}

    @property
    def extra_state_attributes(self) -> dict:
        """What a card needs besides the picture."""
        return {
            "calibration_points": self._points,
            "rooms": self._rooms,
            "robot": self._robot.robot,
            "map": self._robot.map_name,
        }

    async def async_added_to_hass(self) -> None:
        """Follow the robot's coordinator and draw the first frame."""
        await super().async_added_to_hass()
        remove = self._robot.coordinator.async_add_listener(self._source_changed)
        self.async_on_remove(remove)
        await self._refresh()

    @callback
    def _source_changed(self) -> None:
        self.hass.async_create_task(self._refresh())

    async def _refresh(self) -> None:
        """Re-cut the map if the robot has a newer one."""
        snapshot = await self.hass.async_add_executor_job(
            roborock_maps.snapshot, self._robot
        )
        if snapshot is None or snapshot.image == self._source:
            return
        self._source = snapshot.image
        image, references, _box = await self.hass.async_add_executor_job(
            fit, snapshot.image, snapshot.references, self._aspect, DEFAULT_MARGIN
        )
        self._image = image
        self._points = calibration_points(references)
        self._rooms = snapshot.rooms
        self._attr_image_last_updated = snapshot.updated or dt_util.utcnow()
        self.async_write_ha_state()

    async def async_image(self) -> bytes | None:
        """The trimmed map."""
        return self._image

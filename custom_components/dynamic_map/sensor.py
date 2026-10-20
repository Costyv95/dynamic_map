"""`sensor.<phone>_map_position`: the room a phone is in, and where in it (#1354)."""
from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.components.sensor import SensorEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_call_later, async_track_state_change_event, async_track_time_interval

from .const import DOMAIN
from .position import SIGNAL_FINGERPRINTS, SIGNAL_TRACKERS, PositionManager, Tracker

_LOGGER = logging.getLogger(__name__)
REFRESH = timedelta(seconds=5)


async def async_setup_platform(
    hass: HomeAssistant,
    config: dict,
    async_add_entities: AddEntitiesCallback,
    discovery_info: dict | None = None,
) -> None:
    """One map-position sensor per tracked phone, added as phones appear."""
    manager: PositionManager = hass.data[DOMAIN]["position"]
    known: dict[str, MapPositionSensor] = {}

    @callback
    def sync():
        new = [MapPositionSensor(manager, t) for k, t in manager.trackers.items() if k not in known]
        for s in new:
            known[s.tracker.device_id] = s
        for k, s in known.items():
            if k in manager.trackers:
                s.rebind(manager.trackers[k])
        if new:
            async_add_entities(new)

    sync()
    async_dispatcher_connect(hass, SIGNAL_TRACKERS, sync)


class MapPositionSensor(SensorEntity):
    """State: the room. Attributes: floor, x, y (map %), source, confidence."""

    _attr_should_poll = False
    _attr_icon = "mdi:map-marker-account"

    def __init__(self, manager: PositionManager, tracker: Tracker):
        self.manager = manager
        self.tracker = tracker
        self._attr_unique_id = f"map_position_{tracker.device_id}"
        self._attr_name = f"{tracker.name} map position"
        self._pos: dict | None = None
        self._unsub_states = None
        self._pending = None

    @property
    def native_value(self):
        return self._pos["room"] if self._pos else None

    @property
    def extra_state_attributes(self):
        if not self._pos:
            return {"source": "none"}
        return {k: v for k, v in self._pos.items() if k != "room"}

    async def async_added_to_hass(self):
        self._watch()
        self.async_on_remove(async_track_time_interval(self.hass, self._tick, REFRESH))
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_FINGERPRINTS, self._schedule))
        self.async_on_remove(self._unwatch)
        await self._update()

    @callback
    def rebind(self, tracker: Tracker):
        if tracker.watched != self.tracker.watched:
            self.tracker = tracker
            if self.hass:
                self._watch()
                self._schedule()

    @callback
    def _watch(self):
        self._unwatch()
        self._unsub_states = async_track_state_change_event(self.hass, self.tracker.watched, self._schedule)

    @callback
    def _unwatch(self):
        if self._unsub_states:
            self._unsub_states()
            self._unsub_states = None
        if self._pending:
            self._pending()
            self._pending = None

    @callback
    def _schedule(self, *_):
        # Bermuda updates its proxies one after another; settle for a second.
        if self._pending is None:
            self._pending = async_call_later(self.hass, 1, self._fire)

    @callback
    def _fire(self, _now):
        self._pending = None
        self.hass.async_create_task(self._update())

    async def _tick(self, _now):
        await self._update()

    async def _update(self):
        pos = await self.manager.async_locate(self.tracker, self._pos)
        if pos != self._pos:
            self._pos = pos
            self.async_write_ha_state()

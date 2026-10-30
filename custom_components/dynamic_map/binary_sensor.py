"""`binary_sensor.<proxy>_offline`: a Bluetooth proxy that dropped off the network.

One problem sensor per Bermuda proxy, attached to the proxy's own device so
it lands in the proxy's area: the map card's room alerts then show it as a
red badge in that room ("Office Proxy offline") until the proxy is back.
"""
from __future__ import annotations

import time
from datetime import timedelta

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval

from .const import DOMAIN
from .position import SIGNAL_TRACKERS, PositionManager
from .proxy_health import Debounce, device_down

CHECK = timedelta(seconds=30)
PREFIX = "proxy_offline_"


def _proxy_device(dev_reg, mac: str):
    """The device a proxy's MAC belongs to (async_get_device is deprecated in HA 2026.x)."""
    devices = dev_reg.async_get_devices(connections={(dr.CONNECTION_NETWORK_MAC, mac)})
    return devices[0] if devices else None


async def async_setup_platform(hass: HomeAssistant, config: dict, async_add_entities: AddEntitiesCallback,
                               discovery_info: dict | None = None) -> None:
    """A sensor per proxy any tracked phone has a distance sensor for, added as proxies appear."""
    manager: PositionManager = hass.data[DOMAIN]["position"]
    known: set[str] = set()

    @callback
    def sync():
        dev_reg = dr.async_get(hass)
        new = []
        macs = {m for t in manager.trackers.values() for m in t.distance_entities}
        # A proxy that stays away across a restart gets no Bermuda sensor at all: keep the ones seen before.
        macs |= {e.unique_id.removeprefix(PREFIX) for e in er.async_get(hass).entities.values()
                 if e.platform == DOMAIN and e.unique_id.startswith(PREFIX)}
        for mac in sorted(macs):
            device = _proxy_device(dev_reg, mac)
            if mac in known or device is None:
                continue        # a proxy HA has no device for (the host's own adapter) has nothing to watch
            known.add(mac)
            new.append(ProxyOfflineSensor(mac, device.name_by_user or device.name or mac))
        if new:
            async_add_entities(new)

    sync()
    async_dispatcher_connect(hass, SIGNAL_TRACKERS, sync)


class ProxyOfflineSensor(BinarySensorEntity):
    """On while every entity of the proxy's device has been unavailable for 2 minutes."""

    _attr_should_poll = False
    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_icon = "mdi:bluetooth-off"

    def __init__(self, mac: str, name: str):
        self.mac = mac
        self._attr_unique_id = PREFIX + mac
        self._attr_name = f"{name} offline"
        self._debounce = Debounce()
        self._attr_is_on = False
        self.device_id = None

    async def async_added_to_hass(self):
        # Without a config entry HA ignores device_info, so tie the entity to the
        # proxy's device by hand: it then takes the device's area, i.e. its room.
        device = _proxy_device(dr.async_get(self.hass), self.mac)
        self.device_id = device.id if device else None
        entry = self.registry_entry
        if device and entry and entry.device_id != device.id:
            er.async_get(self.hass).async_update_entity(self.entity_id, device_id=device.id)
        self.async_on_remove(async_track_time_interval(self.hass, self._check, CHECK))
        self._check()

    @property
    def extra_state_attributes(self):
        since = self._debounce.since
        return {"mac": self.mac, "down_since": int(since) if since and self._attr_is_on else None}

    @callback
    def _check(self, _now=None):
        ent_reg = er.async_get(self.hass)
        device_id = self.device_id
        states = [
            (st.state if (st := self.hass.states.get(e.entity_id)) else None)
            for e in er.async_entries_for_device(ent_reg, device_id) if e.platform != DOMAIN and not e.disabled_by
        ] if device_id else []
        on = self._debounce.update(device_down(states), time.time())
        if on != self._attr_is_on:
            self._attr_is_on = on
            self.async_write_ha_state()

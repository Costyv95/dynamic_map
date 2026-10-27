"""The calibration-spot side of PositionManager: record, delete, clear, list.

A mixin, split out of position.py under the 300-line rule; it uses the
manager's store, fingerprints, trackers, reading() and async_rooms().
"""
from __future__ import annotations

import asyncio

import voluptuous as vol

from homeassistant.core import ServiceCall, SupportsResponse
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send

from . import position_math as pm
from . import spots as sp
from .const import DOMAIN

SIGNAL_FINGERPRINTS = f"{DOMAIN}_position_fingerprints"


class FingerprintServices:
    # --- fingerprints ------------------------------------------------------

    async def _save(self):
        await self.store.async_save({"fingerprints": self.fingerprints})
        async_dispatcher_send(self.hass, SIGNAL_FINGERPRINTS)

    def tracker_for(self, entity_id: str):
        """A tracker by its map-position sensor, its Bermuda area sensor or its device id."""
        ent_reg = er.async_get(self.hass)
        entry = ent_reg.async_get(entity_id) if entity_id else None
        if entry and entry.platform == DOMAIN and entry.unique_id.startswith("map_position_"):
            return self.trackers.get(entry.unique_id[len("map_position_"):])
        for t in self.trackers.values():
            if entity_id in (t.area_entity, t.device_id):
                return t
        return None

    async def async_record(self, call: ServiceCall):
        tracker = self.tracker_for(call.data["entity_id"])
        if tracker is None:
            raise HomeAssistantError(f"{call.data['entity_id']} is not a tracked phone")
        floor, x, y = call.data["floor"], call.data["x"], call.data["y"]
        rooms = await self.async_rooms(force=True)
        room = pm.room_at(rooms, floor, x, y)
        if room is None:
            raise HomeAssistantError(f"({x}, {y}) on floor {floor} is not inside a room")
        if not tracker.distance_entities:
            # No proxy sensors found for it: a spot would record silence, not a place (#1740).
            raise HomeAssistantError(f"No Bermuda proxy distances for {tracker.name}")
        if tracker.device_id in self._recording:
            raise HomeAssistantError(f"Already recording {tracker.name}")
        self._recording.add(tracker.device_id)
        try:
            samples = []
            for _ in range(int(call.data["seconds"])):
                samples.append(self.reading(tracker))
                await asyncio.sleep(1)
        finally:
            self._recording.discard(tracker.device_id)
        # No proxy hearing the phone is a fingerprint too: silence on a floor without proxies.
        fp = sp.new_spot(tracker.device_id, tracker.name, floor, x, y, room, samples, pm.median_reading(samples))
        self.fingerprints.append(fp)
        await self._save()
        return {"id": fp["id"], "room": fp["room"], "samples": fp["samples"], "proxies": len(fp["features"])}

    async def async_delete(self, call: ServiceCall):
        before = len(self.fingerprints)
        self.fingerprints = [fp for fp in self.fingerprints if fp["id"] != call.data["id"]]
        await self._save()
        return {"deleted": before - len(self.fingerprints)}

    async def async_clear(self, call: ServiceCall):
        floor, room = call.data.get("floor"), call.data.get("room_id")
        before = len(self.fingerprints)
        self.fingerprints = [
            fp for fp in self.fingerprints
            if not ((floor is None or fp["floor"] == floor) and (room is None or fp["room_id"] == room))
        ]
        await self._save()
        return {"deleted": before - len(self.fingerprints)}

    def public_fingerprints(self):
        """What the card draws: spots, never the raw readings."""
        return [
            {k: fp[k] for k in ("id", "name", "floor", "x", "y", "room", "samples", "recorded_at")}
            | {"proxies": len(fp["features"])}
            for fp in self.fingerprints
        ]

    def _register_services(self):
        reg = self.hass.services.async_register
        reg(DOMAIN, "record_fingerprint", self.async_record, vol.Schema({
            vol.Required("entity_id"): cv.string,
            vol.Required("floor"): vol.Coerce(int),
            vol.Required("x"): vol.All(vol.Coerce(float), vol.Range(min=0, max=100)),
            vol.Required("y"): vol.All(vol.Coerce(float), vol.Range(min=0, max=100)),
            vol.Optional("seconds", default=20): vol.All(vol.Coerce(int), vol.Range(min=3, max=60)),
        }), supports_response=SupportsResponse.OPTIONAL)
        reg(DOMAIN, "delete_fingerprint", self.async_delete, vol.Schema({
            vol.Required("id"): cv.string,
        }), supports_response=SupportsResponse.OPTIONAL)
        reg(DOMAIN, "clear_fingerprints", self.async_clear, vol.Schema({
            vol.Optional("floor"): vol.Coerce(int),
            vol.Optional("room_id"): cv.string,
        }), supports_response=SupportsResponse.OPTIONAL)

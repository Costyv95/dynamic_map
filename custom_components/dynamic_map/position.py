"""Room-level Bermuda presence made into a spot on the map (#1354).

Every phone Bermuda tracks (a Bermuda device with an "Area" sensor) gets a
`sensor.<device>_map_position`: state = the room, attributes = floor and
x/y in map percent. The x/y come from fingerprints recorded with the
`dynamic_map.record_fingerprint` service (stand on a spot, tap it on the
map); a room without fingerprints puts the dot at its centre.

The live signal is Bermuda's per-proxy "Distance to <proxy>" sensors.
Bermuda creates them disabled; we enable the ones belonging to tracked
phones. Fingerprints live in HA's private .storage, never in the data dir
(that is served on the LAN without auth).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store

from . import position_math as pm
from .const import DATA_DIR, DOMAIN

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.fingerprints"
STORE_VERSION = 1
SIGNAL_TRACKERS = f"{DOMAIN}_position_trackers"
SIGNAL_FINGERPRINTS = f"{DOMAIN}_position_fingerprints"
MAC_RE = re.compile(r"([0-9a-f]{2}(?::[0-9a-f]{2}){5})", re.I)
ROOMS_RE = re.compile(r"^rooms_floor(\d+)\.json$")
ROOMS_TTL = 60


def _read_rooms(data_dir):
    """{floor: [room, ...]} from every rooms_floorN.json."""
    out = {}
    if not os.path.isdir(data_dir):
        return out
    for name in os.listdir(data_dir):
        m = ROOMS_RE.match(name)
        if not m:
            continue
        try:
            with open(os.path.join(data_dir, name), encoding="utf-8") as f:
                rooms = json.load(f)
        except (OSError, ValueError):
            continue
        if isinstance(rooms, list):
            out[int(m.group(1))] = [r for r in rooms if isinstance(r, dict)]
    return out


class Tracker:
    """One Bermuda-tracked phone."""

    def __init__(self, device_id, name, area_entity, distance_entities):
        self.device_id = device_id
        self.name = name
        self.area_entity = area_entity
        self.distance_entities = distance_entities   # {scanner mac: entity_id}

    @property
    def watched(self):
        return [self.area_entity, *self.distance_entities.values()]


class PositionManager:
    """Trackers, fingerprints, rooms and the services that edit them."""

    def __init__(self, hass: HomeAssistant):
        self.hass = hass
        self.store = Store(hass, STORE_VERSION, STORE_KEY)
        self.fingerprints: list[dict] = []
        self.trackers: dict[str, Tracker] = {}
        self._rooms: dict = {}
        self._rooms_at = 0.0
        self._recording: set[str] = set()

    async def async_start(self):
        data = await self.store.async_load() or {}
        self.fingerprints = list(data.get("fingerprints", []))
        await self.async_rooms(force=True)
        self.discover()
        self._register_services()

        @callback
        def registry_changed(event):
            if event.data.get("action") in ("create", "remove") or "disabled_by" in (event.data.get("changes") or {}):
                self.discover()

        self.hass.bus.async_listen(er.EVENT_ENTITY_REGISTRY_UPDATED, registry_changed)
        # Bermuda adds per-proxy entities as proxies appear; look again once all is up.
        @callback
        def started(_hass):
            self.discover()

        async_at_started(self.hass, started)

    # --- rooms -------------------------------------------------------------

    async def async_rooms(self, force=False):
        if force or time.monotonic() - self._rooms_at > ROOMS_TTL:
            self._rooms = await self.hass.async_add_executor_job(_read_rooms, self.hass.config.path(DATA_DIR))
            self._rooms_at = time.monotonic()
        return self._rooms

    def area_names(self):
        return {a.id: a.name for a in ar.async_get(self.hass).async_list_areas()}

    # --- trackers ----------------------------------------------------------

    @callback
    def discover(self):
        """Find Bermuda's tracked phones and their per-proxy distance sensors."""
        ent_reg = er.async_get(self.hass)
        dev_reg = dr.async_get(self.hass)
        by_device: dict[str, list] = {}
        for entry in ent_reg.entities.values():
            if entry.platform == "bermuda" and entry.device_id and entry.domain == "sensor":
                by_device.setdefault(entry.device_id, []).append(entry)
        found = {}
        for device_id, entries in by_device.items():
            area = next((e for e in entries if e.original_name == "Area"), None)
            if area is None or area.disabled_by:
                continue
            distances = {}
            for e in entries:
                if not (e.original_name or "").startswith("Distance to "):
                    continue
                m = MAC_RE.search(e.unique_id or "")
                if not m:
                    continue
                distances[m.group(1).lower()] = e.entity_id
                if e.disabled_by == er.RegistryEntryDisabler.INTEGRATION:
                    ent_reg.async_update_entity(e.entity_id, disabled_by=None)
                    _LOGGER.info("Dynamic Map: enabled %s for map positions", e.entity_id)
            device = dev_reg.async_get(device_id)
            name = (device.name_by_user or device.name) if device else area.entity_id
            found[device_id] = Tracker(device_id, name, area.entity_id, distances)
        changed = set(found) != set(self.trackers) or any(
            found[k].watched != self.trackers[k].watched for k in found if k in self.trackers
        )
        self.trackers = found
        if changed:
            async_dispatcher_send(self.hass, SIGNAL_TRACKERS)

    def reading(self, tracker: Tracker) -> dict:
        """{scanner mac: metres} for every proxy that hears the phone now."""
        out = {}
        for mac, entity_id in tracker.distance_entities.items():
            st = self.hass.states.get(entity_id)
            d = pm.clamp_distance(st.state) if st else None
            if d is not None:
                out[mac] = d
        return out

    async def async_locate(self, tracker: Tracker, prev: dict | None):
        """The tracker's map position, or None when Bermuda has no room."""
        st = self.hass.states.get(tracker.area_entity)
        rooms = await self.async_rooms()
        floor, room = pm.room_for_area(rooms, st.state if st else None, self.area_names())
        if room is None:
            return None
        base = {"floor": floor, "room": room.get("name"), "room_id": room.get("id"),
                "area": st.state, "area_id": room.get("area_id")}
        fps = [fp for fp in self.fingerprints if fp["floor"] == floor and fp["room_id"] == room.get("id")]
        reading = self.reading(tracker)
        hit = pm.estimate(fps, reading) if fps else None
        if hit is None:
            cx, cy = pm.polygon_centre(room.get("polygon") or [[50, 50]])
            return {**base, "x": cx, "y": cy, "source": "room", "confidence": 0.0,
                    "fingerprints": len(fps), "proxies": len(reading)}
        same_room = prev and prev.get("source") == "fingerprint" and prev.get("room_id") == room.get("id") and prev.get("floor") == floor
        pos = pm.smooth(prev if same_room else None, hit)
        return {**base, "x": pos["x"], "y": pos["y"], "source": "fingerprint",
                "confidence": hit["confidence"], "fingerprints": len(fps), "proxies": len(reading)}

    # --- fingerprints ------------------------------------------------------

    async def _save(self):
        await self.store.async_save({"fingerprints": self.fingerprints})
        async_dispatcher_send(self.hass, SIGNAL_FINGERPRINTS)

    def tracker_for(self, entity_id: str) -> Tracker | None:
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
        if tracker.device_id in self._recording:
            raise HomeAssistantError(f"Already recording {tracker.name}")
        self._recording.add(tracker.device_id)
        try:
            samples = []
            for _ in range(int(call.data["seconds"])):
                if r := self.reading(tracker):
                    samples.append(r)
                await asyncio.sleep(1)
        finally:
            self._recording.discard(tracker.device_id)
        features = pm.median_reading(samples)
        if not features:
            raise HomeAssistantError(f"No proxy heard {tracker.name} while recording")
        fp = {
            "id": uuid.uuid4().hex[:12], "tracker": tracker.device_id, "name": tracker.name,
            "floor": floor, "x": round(x, 2), "y": round(y, 2),
            "room_id": room.get("id"), "room": room.get("name"),
            "features": features, "samples": len(samples), "recorded_at": int(time.time()),
        }
        self.fingerprints.append(fp)
        await self._save()
        return {"id": fp["id"], "room": fp["room"], "samples": fp["samples"], "proxies": len(features)}

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

"""Vacuum schedules kept in Home Assistant instead of the robot's app.

Schedules live in HA's private store (.storage/dynamic_map.vacuum_schedules).
A tick at second 0 of every minute starts the ones that are due. The
`sensor.vacuum_schedules` entity carries them, plus each vacuum's rooms and
mode options, so the map card (and the Portal wall) needs nothing but
entity state and the save/delete/run services.
"""
from __future__ import annotations

import logging
import time
from datetime import timedelta

import voluptuous as vol

from homeassistant.components.sensor import SensorEntity
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.event import async_track_time_change, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import vacuum_schedule_logic as vs
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)
STORE_KEY = f"{DOMAIN}.vacuum_schedules"
SIGNAL = f"{DOMAIN}_vacuum_schedules"
SELECT_KINDS = ("cleaning_mode", "mop_intensity", "mop_mode")
BUSY = ("cleaning", "returning", "unavailable")

SAVE_SCHEMA = vol.Schema({
    vol.Optional("id"): cv.string,
    vol.Optional("name"): cv.string,
    vol.Optional("enabled"): cv.boolean,
    vol.Optional("entity_id"): cv.string,
    vol.Optional("time"): cv.string,
    vol.Optional("days"): [vol.Coerce(int)],
    vol.Optional("rooms"): [cv.string],
    vol.Optional("mode"): cv.string,
    vol.Optional("suction"): vol.Any(None, cv.string),
    vol.Optional("water"): vol.Any(None, cv.string),
    vol.Optional("route"): vol.Any(None, cv.string),
    vol.Optional("repeat"): vol.Coerce(int),
})


class VacuumScheduler:
    """The stored schedules, the minute tick and the services."""

    def __init__(self, hass: HomeAssistant):
        self.hass = hass
        self.store = Store(hass, 1, STORE_KEY)
        self.schedules: list[dict] = []
        self.vacuums: dict[str, dict] = {}   # entity_id -> rooms and options

    async def async_start(self):
        self.schedules = list((await self.store.async_load() or {}).get("schedules", []))
        reg = self.hass.services.async_register
        reg(DOMAIN, "save_vacuum_schedule", self.async_save, SAVE_SCHEMA,
            supports_response=SupportsResponse.OPTIONAL)
        reg(DOMAIN, "delete_vacuum_schedule", self.async_delete,
            vol.Schema({vol.Required("id"): cv.string}))
        reg(DOMAIN, "run_vacuum_schedule", self.async_run_now,
            vol.Schema({vol.Required("id"): cv.string}))
        async_track_time_change(self.hass, self._tick, second=0)
        # Roborock comes up after us: look every 5 min until a vacuum has rooms, then hourly.
        async_track_time_interval(self.hass, self._refresh, timedelta(minutes=5))

    def find(self, sid: str) -> dict:
        for s in self.schedules:
            if s["id"] == sid:
                return s
        raise HomeAssistantError(f"No vacuum schedule {sid}")

    async def _changed(self):
        await self.store.async_save({"schedules": self.schedules})
        async_dispatcher_send(self.hass, SIGNAL)

    # --- services -----------------------------------------------------------

    async def async_save(self, call: ServiceCall):
        data = dict(call.data)
        old = next((s for s in self.schedules if s["id"] == data.get("id")), None)
        try:
            s = vs.normalize(data, old)
        except ValueError as err:
            raise HomeAssistantError(str(err)) from err
        if old:
            self.schedules[self.schedules.index(old)] = s
        else:
            self.schedules.append(s)
        if not (self.vacuums.get(s["entity_id"]) or {}).get("rooms"):
            await self._vacuum_info(s["entity_id"])
        await self._changed()
        return {"schedule": s}

    async def async_delete(self, call: ServiceCall):
        self.schedules.remove(self.find(call.data["id"]))
        await self._changed()

    async def async_run_now(self, call: ServiceCall):
        s = self.find(call.data["id"])
        try:
            await self._run(s, forced=True)
        finally:
            await self._changed()

    # --- running ------------------------------------------------------------

    async def _tick(self, now):
        for s in [s for s in self.schedules if vs.is_due(s, now)]:
            s["last_run"] = now.isoformat(timespec="seconds")
            await self._run(s)
            await self._changed()

    async def _run(self, s: dict, forced=False):
        vac = s["entity_id"]
        state = self.hass.states.get(vac)
        if state is None or (state.state in BUSY and not forced):
            _LOGGER.warning("Vacuum schedule %s skipped: %s is %s",
                            s.get("name") or s["id"], vac, state.state if state else "missing")
            s["last_result"] = f"skipped: {state.state if state else 'missing'}"
            return
        info = await self._vacuum_info(vac)
        try:
            steps = vs.plan(s, info["selects"], info["room_ids"])
            for domain, service, data in steps:
                await self.hass.services.async_call(domain, service, data, blocking=True)
            s["last_result"] = "started"
        except (ValueError, HomeAssistantError) as err:
            s["last_result"] = f"failed: {err}"
            _LOGGER.error("Vacuum schedule %s failed: %s", s.get("name") or s["id"], err)
            if forced:
                raise HomeAssistantError(str(err)) from err

    # --- what each vacuum offers -----------------------------------------------

    async def _refresh(self, _now=None):
        for vac in {s["entity_id"] for s in self.schedules} | set(self._known_vacuums()):
            known = self.vacuums.get(vac)
            if known and known["rooms"] and time.monotonic() - known.get("_at", 0) < 3600:
                continue
            await self._vacuum_info(vac)
        async_dispatcher_send(self.hass, SIGNAL)

    def _known_vacuums(self) -> list[str]:
        return [e.entity_id for e in er.async_get(self.hass).entities.values()
                if e.domain == "vacuum" and e.platform == "roborock" and not e.disabled_by]

    async def _vacuum_info(self, vac: str) -> dict:
        """Rooms (segment id -> name), select entities and options for one vacuum."""
        reg = er.async_get(self.hass)
        entry = reg.async_get(vac)
        selects = {}
        if entry and entry.device_id:
            for e in er.async_entries_for_device(reg, entry.device_id):
                if e.domain == "select" and e.translation_key in SELECT_KINDS:
                    selects[e.translation_key] = e.entity_id
        room_ids = await self._rooms(vac)
        opts = lambda eid: list((self.hass.states.get(eid).attributes.get("options") or [])
                                if eid and self.hass.states.get(eid) else [])
        vstate = self.hass.states.get(vac)
        info = {
            "selects": selects, "room_ids": room_ids,
            "public": {
                "rooms": [room_ids[k] for k in sorted(room_ids)],
                "suction": [f for f in (vstate.attributes.get("fan_speed_list") or [])] if vstate else [],
                "water": opts(selects.get("mop_intensity")),
                "route": opts(selects.get("mop_mode")),
            },
        }
        self.vacuums[vac] = info["public"] | {"_at": time.monotonic()}
        return info

    async def _rooms(self, vac: str) -> dict[int, str]:
        if not self.hass.services.has_service("roborock", "get_maps"):
            return {}
        try:
            resp = await self.hass.services.async_call(
                "roborock", "get_maps", {"entity_id": vac}, blocking=True, return_response=True)
        except HomeAssistantError as err:
            _LOGGER.debug("No Roborock rooms for %s: %s", vac, err)
            return {}
        maps = (resp or {}).get(vac, {}).get("maps") or []
        chosen = next((m for m in maps if m.get("flag") == 0), maps[0] if maps else {})
        return {int(k): str(v) for k, v in (chosen.get("rooms") or {}).items()}


class VacuumSchedulesSensor(SensorEntity):
    """State: how many schedules are on. Attributes: schedules, vacuums, next_run."""

    _attr_should_poll = False
    _attr_icon = "mdi:robot-vacuum-alert"
    _attr_unique_id = "vacuum_schedules"
    _attr_name = "Vacuum schedules"

    def __init__(self, scheduler: VacuumScheduler):
        self.scheduler = scheduler

    @property
    def native_value(self):
        return sum(1 for s in self.scheduler.schedules if s.get("enabled"))

    @property
    def extra_state_attributes(self):
        now = dt_util.now()
        runs = {s["id"]: vs.next_run(s, now) for s in self.scheduler.schedules}
        upcoming = [r for r in runs.values() if r]
        return {
            "schedules": [s | {"next_run": runs[s["id"]].isoformat() if runs[s["id"]] else None}
                          for s in self.scheduler.schedules],
            "vacuums": {v: {k: x for k, x in o.items() if k != "_at"}
                        for v, o in self.scheduler.vacuums.items()},
            "next_run": min(upcoming).isoformat() if upcoming else None,
        }

    async def async_added_to_hass(self):
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL, self.async_write_ha_state))
        # next_run moves on as days pass even when nothing is edited.
        self.async_on_remove(async_track_time_change(
            self.hass, callback(lambda _now: self.async_write_ha_state()), minute=1, second=5))
        self.hass.async_create_task(self.scheduler._refresh())

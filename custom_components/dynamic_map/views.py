"""HTTP API views for the Dynamic Map integration.

All views require authentication; mutating endpoints additionally require an
admin user. Responses keep the legacy ``{"success": bool, ...}`` body shape
the frontend expects, but now also carry meaningful HTTP status codes.
"""
import base64
import json
import logging
import os

import aiohttp

from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers import area_registry, entity_registry, floor_registry
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_SIDECAR_URL, DATA_DIR, DOMAIN, URL_BASE_DATA
from . import storage

_LOGGER = logging.getLogger(__name__)

SIDECAR_TIMEOUT = aiohttp.ClientTimeout(total=300)


class DynamicMapView(HomeAssistantView):
    """Base class: authenticated view with shared helpers."""

    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    @property
    def data_dir(self):
        return self.hass.config.path(DATA_DIR)

    def error(self, message, status=400):
        return self.json({"success": False, "error": message}, status_code=status)

    def forbidden_unless_admin(self, request):
        """Return an error response if the caller is not an admin, else None."""
        user = request.get("hass_user")
        if user is None or not user.is_admin:
            return self.error("Admin privileges required.", status=403)
        return None


class DynamicMapSaveView(DynamicMapView):
    """Save per-floor map data (rooms/shortcuts/config JSON or background PNG)."""

    url = "/api/dynamic_map/save"
    name = "api:dynamic_map:save"

    async def post(self, request):
        if (denied := self.forbidden_unless_admin(request)) is not None:
            return denied
        try:
            data = await request.json()
        except ValueError:
            return self.error("Invalid JSON body.")

        filename = data.get("filename")
        if not storage.is_allowed_data_filename(filename):
            return self.error(
                "Invalid filename. Expected rooms_floorN.json, shortcuts_floorN.json, "
                "config_floorN.json or bg_floorN.png."
            )

        save_path = os.path.join(self.data_dir, filename)

        # Builder Mode: background image for a manually-added floor.
        if filename.endswith(".png"):
            image_b64 = data.get("image_base64")
            if not image_b64:
                return self.error("Missing image_base64 for background upload.")
            try:
                raw = base64.b64decode(image_b64.split(",")[-1])
            except (ValueError, TypeError):
                return self.error("image_base64 is not valid base64 data.")
            if len(raw) > storage.MAX_BACKGROUND_BYTES:
                return self.error("Background image too large.", status=413)

            def save_image():
                with open(save_path, "wb") as f:
                    f.write(raw)

            await self.hass.async_add_executor_job(save_image)
            return self.json({"success": True})

        content = data.get("content")
        if content is None:
            return self.error("Missing content.")
        if not storage.validate_save_content(filename, content):
            return self.error(f"Content has the wrong shape for {filename}.")

        def save_file():
            with open(save_path, "w", encoding="utf-8") as f:
                json.dump(content, f, ensure_ascii=False, indent=2)

        try:
            await self.hass.async_add_executor_job(save_file)
        except OSError as err:
            _LOGGER.error("Failed to save %s: %s", filename, err)
            return self.error(str(err), status=500)
        return self.json({"success": True})


class DynamicMapStateView(DynamicMapView):
    """Fetch state and attributes of a single entity."""

    url = "/api/dynamic_map/state"
    name = "api:dynamic_map:state"

    async def get(self, request):
        entity_id = request.query.get("entity_id")
        if not entity_id:
            return self.error("Missing entity_id parameter.")

        state = self.hass.states.get(entity_id)
        if state is None:
            return self.error("Entity not found.", status=404)

        return self.json(
            {"success": True, "state": state.state, "attributes": dict(state.attributes)}
        )


class DynamicMapEntitiesView(DynamicMapView):
    """List all entity IDs with friendly names (editor autocomplete)."""

    url = "/api/dynamic_map/entities"
    name = "api:dynamic_map:entities"

    async def get(self, request):
        entities = [
            {
                "id": state.entity_id,
                "name": state.attributes.get("friendly_name") or state.entity_id,
            }
            for state in self.hass.states.async_all()
        ]
        return self.json({"success": True, "entities": entities})


class DynamicMapFilesView(DynamicMapView):
    """List DXF/SVG source files and custom icons in the data dir."""

    url = "/api/dynamic_map/files"
    name = "api:dynamic_map:files"

    async def get(self, request):
        data_dir = self.data_dir

        def get_files():
            return {
                "files": storage.list_source_files(data_dir),
                "icons": storage.list_icons(data_dir, URL_BASE_DATA),
            }

        data = await self.hass.async_add_executor_job(get_files)
        return self.json({"success": True, **data})


class DynamicMapFloorsView(DynamicMapView):
    """List floors discovered from data files, plus the integration version."""

    url = "/api/dynamic_map/floors"
    name = "api:dynamic_map:floors"

    async def get(self, request):
        floors = await self.hass.async_add_executor_job(
            storage.discover_floors, self.data_dir
        )
        return self.json(
            {
                "success": True,
                "floors": floors,
                "version": self.hass.data.get(DOMAIN, {}).get("version"),
            }
        )


class DynamicMapRecomputeView(DynamicMapView):
    """Recompute a floor's rooms/background from DXF/SVG via the sidecar."""

    url = "/api/dynamic_map/recompute"
    name = "api:dynamic_map:recompute"

    async def post(self, request):
        if (denied := self.forbidden_unless_admin(request)) is not None:
            return denied
        try:
            data = await request.json()
        except ValueError:
            return self.error("Invalid JSON body.")

        floor_num = data.get("floor_num")
        if not floor_num:
            return self.error("Missing floor_num.")

        sidecar_url = self.hass.data.get(DOMAIN, {}).get(CONF_SIDECAR_URL)
        if not sidecar_url:
            return self.error(
                "No sidecar configured. Add 'sidecar_url' under 'dynamic_map:' in "
                "configuration.yaml (see server/README)."
            )

        payload = {
            "floor": floor_num,
            "svg_file": data.get("svg_file"),
            "dxf_file": data.get("dxf_file"),
        }
        session = async_get_clientsession(self.hass)
        try:
            async with session.post(
                f"{sidecar_url}/process", json=payload, timeout=SIDECAR_TIMEOUT
            ) as resp:
                result = await resp.json()
        except (aiohttp.ClientError, TimeoutError) as err:
            _LOGGER.error("Sidecar request failed: %s", err)
            return self.error(f"Sidecar unreachable at {sidecar_url}: {err}", status=502)

        if not result.get("success"):
            return self.error(result.get("error", "Unknown error from sidecar"), status=502)
        return self.json({"success": True})


class DynamicMapDeleteFloorView(DynamicMapView):
    """Delete all data files belonging to one floor."""

    url = "/api/dynamic_map/delete_floor"
    name = "api:dynamic_map:delete_floor"

    async def post(self, request):
        if (denied := self.forbidden_unless_admin(request)) is not None:
            return denied
        try:
            data = await request.json()
        except ValueError:
            return self.error("Invalid JSON body.")

        floor_num = data.get("floor_num")
        if not floor_num:
            return self.error("Missing floor_num.")

        data_dir = self.data_dir

        def delete_files():
            deleted = False
            for filename in storage.floor_filenames(floor_num):
                file_path = os.path.join(data_dir, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    deleted = True
            return deleted

        deleted = await self.hass.async_add_executor_job(delete_files)
        if not deleted:
            return self.error(f"No files found for floor {floor_num}.", status=404)
        return self.json({"success": True, "message": f"Floor {floor_num} deleted."})


class DynamicMapRegistryView(DynamicMapView):
    """Expose HA floors and areas (with a default light per area)."""

    url = "/api/dynamic_map/registry"
    name = "api:dynamic_map:registry"

    async def get(self, request):
        ar = area_registry.async_get(self.hass)
        fr = floor_registry.async_get(self.hass)
        er = entity_registry.async_get(self.hass)

        floors = [
            {"id": floor_id, "name": floor.name, "level": floor.level}
            for floor_id, floor in fr.floors.items()
        ]

        areas = []
        for area_id, area in ar.areas.items():
            lights = [
                entry.entity_id
                for entry in er.entities.values()
                if entry.area_id == area_id and entry.domain == "light"
            ]
            areas.append(
                {
                    "id": area_id,
                    "name": area.name,
                    "floor_id": area.floor_id,
                    "default_light": lights[0] if lights else None,
                }
            )

        return self.json({"success": True, "floors": floors, "areas": areas})


class DynamicMapRoborockRoomsView(DynamicMapView):
    """Fetch Roborock room segments via the roborock.get_maps service."""

    url = "/api/dynamic_map/roborock_rooms"
    name = "api:dynamic_map:roborock_rooms"

    async def get(self, request):
        entity_id = request.query.get("entity_id")
        if not entity_id:
            return self.error("entity_id is required.")

        if not self.hass.services.has_service("roborock", "get_maps"):
            return self.error("roborock.get_maps service not found.", status=404)

        try:
            response = await self.hass.services.async_call(
                "roborock",
                "get_maps",
                service_data={"entity_id": entity_id},
                blocking=True,
                return_response=True,
            )
        except Exception as err:  # service call errors are heterogeneous
            _LOGGER.error("roborock.get_maps failed: %s", err)
            return self.error(str(err), status=502)
        return self.json({"success": True, "data": response})


ALL_VIEWS = (
    DynamicMapSaveView,
    DynamicMapStateView,
    DynamicMapEntitiesView,
    DynamicMapFilesView,
    DynamicMapFloorsView,
    DynamicMapRecomputeView,
    DynamicMapDeleteFloorView,
    DynamicMapRegistryView,
    DynamicMapRoborockRoomsView,
)

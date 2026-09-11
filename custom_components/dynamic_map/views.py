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

from .const import (
    CONF_ANTHROPIC_API_KEY,
    CONF_SIDECAR_URL,
    CONF_TEXTURE_MODEL,
    CONF_TEXTURE_SIDECAR_URL,
    DATA_DIR,
    DOMAIN,
    URL_BASE_DATA,
)
from . import storage, texture_gen

_LOGGER = logging.getLogger(__name__)

SIDECAR_TIMEOUT = aiohttp.ClientTimeout(total=300)
TEXTURE_TIMEOUT = aiohttp.ClientTimeout(total=240)

from .views_base import DynamicMapView  # noqa: F401  (re-exported)
from .views_tools import (
    DynamicMapDeleteFloorView,
    DynamicMapGenerateTextureView,
    DynamicMapRecomputeView,
    DynamicMapRegistryView,
    DynamicMapRoborockRoomsView,
)


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
        names = await self.hass.async_add_executor_job(storage.floor_names, self.data_dir)
        return self.json(
            {
                "success": True,
                "floors": floors,
                "names": {str(k): v for k, v in names.items()},
                "version": self.hass.data.get(DOMAIN, {}).get("version"),
            }
        )



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
    DynamicMapGenerateTextureView,
)

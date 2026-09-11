"""Tool views: sidecar recompute, floor deletion, HA registry, Roborock rooms, texture generation."""
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

from .views_base import DynamicMapView


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


class DynamicMapGenerateTextureView(DynamicMapView):
    """Generate a style-recipe texture SVG with Claude and save it to icons/.

    The Anthropic key comes from configuration.yaml (use !secret); it lives
    only in hass.data and is never logged or echoed back to the client.
    """

    url = "/api/dynamic_map/generate_texture"
    name = "api:dynamic_map:generate_texture"

    async def post(self, request):
        if (denied := self.forbidden_unless_admin(request)) is not None:
            return denied
        try:
            data = await request.json()
        except ValueError:
            return self.error("Invalid JSON body.")

        description = (data.get("description") or "").strip()
        if not description:
            return self.error("Missing 'description'.")
        state_description = (data.get("state_description") or "").strip()
        subject = (
            f"{description}, {state_description}" if state_description else description
        )
        tileable = bool(data.get("tileable"))
        style = "decor" if data.get("style") == "decor" else "badge"

        domain_data = self.hass.data.get(DOMAIN, {})
        agent_url = domain_data.get(CONF_TEXTURE_SIDECAR_URL)
        api_key = domain_data.get(CONF_ANTHROPIC_API_KEY)
        if not agent_url and not api_key:
            return self.error(
                "No texture backend configured for dynamic_map: set "
                "texture_sidecar_url (a claude-agent instance) or "
                "anthropic_api_key (via !secret) in configuration.yaml.",
                status=409,
            )
        try:
            filename = texture_gen.texture_filename(subject, data.get("filename"))
        except ValueError as err:
            return self.error(str(err))

        session = async_get_clientsession(self.hass)
        try:
            if agent_url:
                # Preferred: headless Claude Code (operator's subscription).
                payload = {
                    "prompt": texture_gen.build_prompt(subject, tileable, style),
                    "timeout_s": 220,
                    # self-label in the bodegai runs pane (display-only)
                    "consumer": "dynamic_map",
                }
                if domain_data.get(CONF_TEXTURE_MODEL):
                    # CLI-style alias ('sonnet', 'opus') or a full model id
                    payload["model"] = domain_data[CONF_TEXTURE_MODEL]
                async with session.post(
                    f"{agent_url.rstrip('/')}/run",
                    json=payload,
                    timeout=TEXTURE_TIMEOUT,
                ) as resp:
                    body = await resp.json()
                    if resp.status != 200:
                        return self.error(
                            f"claude-agent error {resp.status}: {body.get('error', 'unknown')}",
                            status=502,
                        )
                text = body.get("text", "")
            else:
                model = (
                    domain_data.get(CONF_TEXTURE_MODEL)
                    or texture_gen.DEFAULT_TEXTURE_MODEL
                )
                async with session.post(
                    texture_gen.ANTHROPIC_API_URL,
                    json=texture_gen.build_request_body(subject, model, tileable, style),
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": texture_gen.ANTHROPIC_VERSION,
                    },
                    timeout=TEXTURE_TIMEOUT,
                ) as resp:
                    body = await resp.json()
                    if resp.status != 200:
                        message = (body.get("error") or {}).get("message", "unknown error")
                        return self.error(
                            f"Claude API error {resp.status}: {message}", status=502
                        )
                text = texture_gen.response_text(body)
        except (aiohttp.ClientError, TimeoutError) as err:
            return self.error(f"Texture backend request failed: {err}", status=502)

        try:
            svg = texture_gen.extract_svg(text)
            texture_gen.validate_svg(svg)
        except ValueError as err:
            return self.error(f"Generated SVG rejected: {err}", status=502)

        icons_dir = os.path.join(self.data_dir, "icons")
        path = os.path.join(icons_dir, filename)

        def _write():
            os.makedirs(icons_dir, exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(svg)

        await self.hass.async_add_executor_job(_write)
        _LOGGER.info("Generated texture %s (%d bytes)", filename, len(svg))
        return self.json(
            {
                "success": True,
                "path": f"{URL_BASE_DATA}/icons/{filename}",
                "bytes": len(svg),
            }
        )

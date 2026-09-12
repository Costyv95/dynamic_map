"""Dynamic Floorplan Map — native SVG map card + sidebar editor for Home Assistant."""
import logging
import os
import time

import voluptuous as vol

import homeassistant.helpers.config_validation as cv
from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import discovery
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.start import async_at_started
from homeassistant.loader import async_get_integration

from . import roborock_maps, storage
from .const import (
    CONF_ANTHROPIC_API_KEY,
    CONF_SIDECAR_URL,
    CONF_TEXTURE_MODEL,
    CONF_TEXTURE_SIDECAR_URL,
    CONF_VACUUM_MAP_ASPECT,
    CONF_VACUUM_MAPS,
    DATA_DIR,
    DOMAIN,
    URL_BASE_DATA,
    URL_BASE_UI,
)
from .views import ALL_VIEWS

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = vol.Schema(
    {
        DOMAIN: vol.Schema(
            {
                vol.Optional(CONF_SIDECAR_URL): cv.url,
                vol.Optional(CONF_ANTHROPIC_API_KEY): cv.string,
                vol.Optional(CONF_TEXTURE_MODEL): cv.string,
                vol.Optional(CONF_TEXTURE_SIDECAR_URL): cv.url,
                vol.Optional(CONF_VACUUM_MAPS): cv.boolean,
                vol.Optional(CONF_VACUUM_MAP_ASPECT): vol.Any(
                    vol.All(vol.Coerce(float), vol.Range(min=0.2, max=5)), False
                ),
            },
        )
    },
    extra=vol.ALLOW_EXTRA,
)


async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the Dynamic Map component."""
    conf = config.get(DOMAIN) or {}
    integration = await async_get_integration(hass, DOMAIN)

    hass.data[DOMAIN] = {
        "version": integration.version,
        CONF_SIDECAR_URL: conf.get(CONF_SIDECAR_URL),
        CONF_ANTHROPIC_API_KEY: conf.get(CONF_ANTHROPIC_API_KEY),
        CONF_TEXTURE_MODEL: conf.get(CONF_TEXTURE_MODEL),
        CONF_TEXTURE_SIDECAR_URL: conf.get(CONF_TEXTURE_SIDECAR_URL),
    }

    for view_cls in ALL_VIEWS:
        hass.http.register_view(view_cls(hass))

    frontend_dir = hass.config.path("custom_components", DOMAIN, "frontend")
    data_dir = hass.config.path(DATA_DIR)
    if not await hass.async_add_executor_job(os.path.exists, data_dir):
        await hass.async_add_executor_job(os.makedirs, data_dir)
    if created := await hass.async_add_executor_job(storage.ensure_global_lists, data_dir):
        _LOGGER.debug("Dynamic Map: created empty %s", ", ".join(created))

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(URL_BASE_UI, frontend_dir, cache_headers=False),
            StaticPathConfig(URL_BASE_DATA, data_dir, cache_headers=False),
        ]
    )

    # Native custom panel: the editor element receives `hass` directly, so it
    # needs no iframe and no token hand-off. The version query busts caches
    # after every restart (deploys restart HA).
    module_url = f"{URL_BASE_UI}/dynamic-map-panel.js?v={integration.version}-{int(time.time())}"
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Map Editor",
        sidebar_icon="mdi:map-search-outline",
        frontend_url_path="dynamic_map_editor",
        config={
            "_panel_custom": {
                "name": "dynamic-map-panel",
                "module_url": module_url,
                "embed_iframe": False,
                "trust_external": False,
            }
        },
        require_admin=True,
    )

    if conf.get(CONF_VACUUM_MAPS, True):
        _serve_aligned_maps(hass, config, conf.get(CONF_VACUUM_MAP_ASPECT, 1.5) or None)

    _LOGGER.info("Dynamic Map %s loaded", integration.version)
    return True


def _serve_aligned_maps(hass: HomeAssistant, config: dict, aspect):
    """Publish an aligned image entity for every robot map we can find.

    Roborock discovers its maps a while after start-up, so look again a few
    times before giving up. Nothing is created when there is no robot.
    """
    tries = 0

    async def look(_now=None):
        nonlocal tries
        tries += 1
        if maps := roborock_maps.discover(hass):
            hass.async_create_task(
                discovery.async_load_platform(
                    hass, "image", DOMAIN, {"maps": maps, "aspect": aspect}, config
                )
            )
            return
        if tries < 5:
            async_call_later(hass, 20, look)

    async_at_started(hass, look)

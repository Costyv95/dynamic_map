"""Dynamic Floorplan Map — native SVG map card + sidebar editor for Home Assistant."""
import logging
import os
import time

import voluptuous as vol

import homeassistant.helpers.config_validation as cv
from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import (
    CONF_ANTHROPIC_API_KEY,
    CONF_SIDECAR_URL,
    CONF_TEXTURE_MODEL,
    CONF_TEXTURE_SIDECAR_URL,
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

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(URL_BASE_UI, frontend_dir, cache_headers=False),
            StaticPathConfig(URL_BASE_DATA, data_dir, cache_headers=False),
        ]
    )

    async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title="Map Editor",
        sidebar_icon="mdi:map-search-outline",
        frontend_url_path="dynamic_map_editor",
        # Include the startup time so the editor shell is re-fetched after every
        # restart (deploys restart HA), regardless of browser heuristic caching.
        config={"url": f"{URL_BASE_UI}/editor.html?v={integration.version}-{int(time.time())}"},
        require_admin=True,
    )

    _LOGGER.info("Dynamic Map %s loaded", integration.version)
    return True

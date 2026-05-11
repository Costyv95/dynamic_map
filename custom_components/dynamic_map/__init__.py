import logging
import os
import json
from homeassistant.core import HomeAssistant
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.components.frontend import async_register_built_in_panel

_LOGGER = logging.getLogger(__name__)

DOMAIN = "dynamic_map"

async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the Dynamic Map component."""
    
    # Register the save API endpoint
    hass.http.register_view(DynamicMapSaveView(hass))
    hass.http.register_view(DynamicMapStateView(hass))
    
    # Expose the frontend folder statically
    frontend_dir = hass.config.path("custom_components", DOMAIN, "frontend")
    
    # Expose the user data folder statically
    data_dir = hass.config.path(DOMAIN + "_data")
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        
    await hass.http.async_register_static_paths([
        StaticPathConfig("/dynamic_map_ui", frontend_dir, cache_headers=False),
        StaticPathConfig("/dynamic_map_data", data_dir, cache_headers=False)
    ])
    
    # Register the custom panel editor
    async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title="Map Editor",
        sidebar_icon="mdi:map-search-outline",
        frontend_url_path="dynamic_map_editor",
        config={"url": "/dynamic_map_ui/editor.html?v=2.4"},
        require_admin=True,
    )
    
    _LOGGER.info("Dynamic Map Component loaded successfully. Registered /api/dynamic_map/save endpoint and /dynamic_map_ui static path.")
    return True

class DynamicMapSaveView(HomeAssistantView):
    """View to handle saving map configurations."""
    url = "/api/dynamic_map/save"
    name = "api:dynamic_map:save"
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request):
        """Handle POST request to save data."""
        try:
            data = await request.json()
            filename = data.get("filename")
            content = data.get("content")
            
            if not filename or content is None:
                return self.json({"success": False, "error": "Missing filename or content"})

            # Enforce security: only allow saving json files, and block directory traversal
            if not filename.endswith(".json") or ".." in filename or "/" in filename:
                return self.json({"success": False, "error": "Invalid filename format."})

            # Save to the isolated data directory so HACS updates don't destroy it
            save_path = self.hass.config.path(DOMAIN + "_data", filename)
            
            def save_file():
                with open(save_path, "w", encoding="utf-8") as f:
                    # Write unescaped JSON
                    json.dump(content, f, ensure_ascii=False, indent=2)

            await self.hass.async_add_executor_job(save_file)
            return self.json({"success": True})
        
        except Exception as e:
            _LOGGER.error(f"Failed to save dynamic map config: {e}")
            return self.json({"success": False, "error": str(e)})

class DynamicMapStateView(HomeAssistantView):
    """View to fetch state and attributes of an entity."""
    url = "/api/dynamic_map/state"
    name = "api:dynamic_map:state"
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request):
        """Handle GET request to fetch entity state."""
        entity_id = request.query.get("entity_id")
        if not entity_id:
            return self.json({"success": False, "error": "Missing entity_id parameter."})

        state = self.hass.states.get(entity_id)
        if state is None:
            return self.json({"success": False, "error": "Entity not found."})

        return self.json({
            "success": True,
            "state": state.state,
            "attributes": dict(state.attributes)
        })

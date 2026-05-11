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
    hass.http.register_view(DynamicMapFilesView(hass))
    hass.http.register_view(DynamicMapRecomputeView(hass))
    
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
    
    _LOGGER.info("Dynamic Map Component loaded successfully.")
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

class DynamicMapFilesView(HomeAssistantView):
    """View to list available DXF and SVG files."""
    url = "/api/dynamic_map/files"
    name = "api:dynamic_map:files"
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request):
        data_dir = self.hass.config.path(DOMAIN + "_data")
        files = []
        if os.path.exists(data_dir):
            files = [f for f in os.listdir(data_dir) if f.endswith('.dxf') or f.endswith('.svg')]
        return self.json({"success": True, "files": files})

class DynamicMapRecomputeView(HomeAssistantView):
    """View to handle recomputing the map from DXF/SVG."""
    url = "/api/dynamic_map/recompute"
    name = "api:dynamic_map:recompute"
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request):
        try:
            data = await request.json()
            floor_num = data.get("floor_num")
            svg_file = data.get("svg_file")
            dxf_file = data.get("dxf_file")

            if not floor_num:
                return self.json({"success": False, "error": "Missing floor_num"})

            data_dir = self.hass.config.path(DOMAIN + "_data")

            def run_processor():
                import sys
                frontend_dir = self.hass.config.path("custom_components", DOMAIN, "frontend")
                if frontend_dir not in sys.path:
                    sys.path.append(frontend_dir)
                    
                import dxf_processor
                dxf_processor.process_dxf(data_dir, floor_num, svg_file, dxf_file)

            await self.hass.async_add_executor_job(run_processor)
            return self.json({"success": True})
            
        except Exception as e:
            _LOGGER.error(f"Failed to recompute dynamic map: {e}")
            return self.json({"success": False, "error": str(e)})

"""Constants for the Dynamic Map integration."""

DOMAIN = "dynamic_map"

# Folder (inside the HA config dir) holding user map data: backgrounds, rooms, shortcuts.
DATA_DIR = f"{DOMAIN}_data"

# Static URL bases registered by the integration.
URL_BASE_UI = "/dynamic_map_ui"
URL_BASE_DATA = "/dynamic_map_data"

# configuration.yaml options
CONF_SIDECAR_URL = "sidecar_url"
# Anthropic key for editor-triggered texture generation. Reference a !secret in
# configuration.yaml; the value stays in hass.data and is never logged.
CONF_ANTHROPIC_API_KEY = "anthropic_api_key"
CONF_TEXTURE_MODEL = "texture_model"
# Preferred texture backend: a claude-agent instance (headless Claude Code on
# the operator's subscription) - e.g. http://192.168.1.202:8098
CONF_TEXTURE_SIDECAR_URL = "texture_sidecar_url"

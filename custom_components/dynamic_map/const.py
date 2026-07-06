"""Constants for the Dynamic Map integration."""

DOMAIN = "dynamic_map"

# Folder (inside the HA config dir) holding user map data: backgrounds, rooms, shortcuts.
DATA_DIR = f"{DOMAIN}_data"

# Static URL bases registered by the integration.
URL_BASE_UI = "/dynamic_map_ui"
URL_BASE_DATA = "/dynamic_map_data"

# configuration.yaml options
CONF_SIDECAR_URL = "sidecar_url"

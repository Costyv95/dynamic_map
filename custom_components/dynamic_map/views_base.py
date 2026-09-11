"""Base class for the Dynamic Map HTTP views."""
import logging

from homeassistant.components.http import HomeAssistantView

from .const import DATA_DIR

_LOGGER = logging.getLogger(__name__)


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


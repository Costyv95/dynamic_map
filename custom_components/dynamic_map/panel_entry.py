"""The Map Editor panel's never-cached entry module (HA-free, so it is testable).

The UI files are served with long cache headers because every URL carries
the deploy's ?v= stamp; only this one-line module is revalidated, so a
frontend-only deploy reaches the editor without restarting HA.
"""
import re

URL_BASE_UI = "/dynamic_map_ui"
PANEL_ENTRY_URL = "/dynamic_map_panel_entry.js"
_STAMP_RE = re.compile(r"\?v=([A-Za-z0-9.\-_]+)")


def panel_entry_js(panel_source):
    """Re-export the panel at the version its own imports carry."""
    m = _STAMP_RE.search(panel_source or "")
    stamp = m.group(1) if m else "0"
    return f"import '{URL_BASE_UI}/dynamic-map-panel.js?v={stamp}';\n"

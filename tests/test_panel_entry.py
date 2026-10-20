"""The Map Editor's never-cached entry module (panel_entry.py). HA-free; loaded by path."""
import importlib.util
import os

PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "custom_components", "dynamic_map", "panel_entry.py",
)
spec = importlib.util.spec_from_file_location("dynamic_map_panel_entry", PATH)
pe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pe)


def test_entry_reexports_the_panel_at_its_stamp():
    src = "import { EditorApp } from './editor.js?v=4.0.0-abc1234';\n"
    assert pe.panel_entry_js(src) == "import '/dynamic_map_ui/dynamic-map-panel.js?v=4.0.0-abc1234';\n"


def test_entry_without_a_stamp_still_loads():
    assert pe.panel_entry_js("") == "import '/dynamic_map_ui/dynamic-map-panel.js?v=0';\n"

"""Unit tests for custom_components/dynamic_map/proxy_health.py (offline proxy alerts)."""
import importlib.util
import os

PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "custom_components", "dynamic_map", "proxy_health.py",
)
spec = importlib.util.spec_from_file_location("dynamic_map_proxy_health", PATH)
ph = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ph)


def test_device_is_down_only_when_nothing_of_it_is_available():
    assert ph.device_down(["unavailable", None])
    assert not ph.device_down(["unavailable", "unknown"])   # a button reads unknown while the proxy is up
    assert not ph.device_down([])                           # no entities: nothing to judge


def test_offline_only_after_two_minutes_down_and_clears_at_once():
    d = ph.Debounce()
    assert not d.update(True, 1000)          # HA restart / reboot blip
    assert not d.update(True, 1119)
    assert d.update(True, 1120)
    assert not d.update(False, 1130)         # back: clears immediately
    assert not d.update(True, 1140)          # a new outage starts its own clock

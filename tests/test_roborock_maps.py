"""Unit tests for custom_components/dynamic_map/roborock_maps.py.

The module only duck-types Home Assistant and the Roborock integration, so
the tests stand in fakes for both. Run with: python -m pytest tests/
"""
import importlib.util
import os
import sys
import types
from dataclasses import dataclass

import pytest

COMPONENT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "custom_components", "dynamic_map",
)

# A stand-in for the map parser's Point, which roborock_maps imports lazily.
parser_pkg = types.ModuleType("vacuum_map_parser_base")
parser_mod = types.ModuleType("vacuum_map_parser_base.map_data")


@dataclass
class Point:
    x: float
    y: float
    a: float | None = None


parser_mod.Point = Point
sys.modules.setdefault("vacuum_map_parser_base", parser_pkg)
sys.modules.setdefault("vacuum_map_parser_base.map_data", parser_mod)

package = types.ModuleType("dmap")
package.__path__ = [COMPONENT_DIR]
sys.modules["dmap"] = package
spec = importlib.util.spec_from_file_location(
    "dmap.roborock_maps", os.path.join(COMPONENT_DIR, "roborock_maps.py")
)
roborock_maps = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = roborock_maps
spec.loader.exec_module(roborock_maps)


class Dimensions:
    """The real parser's pixel transform: 50 mm per pixel, y flipped."""

    def __init__(self, left=367, top=363, height=489, scale=4):
        self.left, self.top, self.height, self.scale = left, top, height, scale

    def to_img(self, point):
        return Point(
            (point.x / 50 - self.left) * self.scale,
            (self.height - (point.y / 50 - self.top) - 1) * self.scale,
        )


class Room:
    def __init__(self, box):
        self.x0, self.y0, self.x1, self.y1 = box


def make_coordinator(image=b"PNG", flags=(0,), rooms=None, broken=False, name="Saros 20X"):
    """A fake Roborock v1 coordinator holding one parsed map per flag."""
    map_data = types.SimpleNamespace(
        image=types.SimpleNamespace(dimensions=Dimensions()),
        rooms={1: Room([24800, 24950, 27150, 29500])} if rooms is None else rooms,
    )
    content = {
        flag: types.SimpleNamespace(image_content=image, map_data=map_data)
        for flag in flags
    }
    info = {
        flag: types.SimpleNamespace(
            name="Home",
            rooms=[types.SimpleNamespace(segment_id=1, raw_name="Kitchen")],
        )
        for flag in flags
    }

    class Home:
        @property
        def home_map_content(self):
            if broken:
                raise AttributeError("roborock moved things around")
            return content

        @property
        def home_map_info(self):
            return info

    return types.SimpleNamespace(
        duid="zDoziiJh",
        duid_slug="saros_20x",
        device_info={"name": name},
        properties_api=types.SimpleNamespace(home=Home()),
        last_home_update=None,
    )


def make_hass(coordinators, runtime=True):
    entry = types.SimpleNamespace()
    if runtime:
        entry.runtime_data = types.SimpleNamespace(v1=coordinators)
    hass = types.SimpleNamespace(
        config_entries=types.SimpleNamespace(async_entries=lambda domain: [entry])
    )
    return hass


class TestDiscover:
    def test_lists_one_map_per_robot_map(self):
        maps = roborock_maps.discover(make_hass([make_coordinator(flags=(0, 1))]))
        assert [(m.robot, m.flag, m.map_name) for m in maps] == [
            ("Saros 20X", 0, "Home"), ("Saros 20X", 1, "Home")
        ]
        assert maps[0].key == "zdoziijh_0"

    def test_stays_quiet_when_roborock_internals_are_not_there(self):
        assert roborock_maps.discover(make_hass([make_coordinator(broken=True)])) == []
        assert roborock_maps.discover(make_hass([], runtime=False)) == []


class TestSnapshot:
    def test_references_match_the_map_the_robot_reports(self):
        robot = roborock_maps.discover(make_hass([make_coordinator()]))[0]
        snap = roborock_maps.snapshot(robot)
        assert [(r.vacuum_x, r.vacuum_y, r.map_x, r.map_y) for r in snap.references] == [
            (25500, 25500, 572.0, 1364.0),
            (35500, 25500, 1372.0, 1364.0),
            (25500, 35500, 572.0, 564.0),
        ]
        assert snap.rooms == {
            "1": {"x0": 24800, "y0": 24950, "x1": 27150, "y1": 29500, "name": "Kitchen"}
        }
        assert snap.image == b"PNG"

    @pytest.mark.parametrize("kwargs", [{"broken": True}, {"image": b""}])
    def test_no_snapshot_without_a_readable_map(self, kwargs):
        robot = roborock_maps.discover(make_hass([make_coordinator()]))[0]
        robot.coordinator = make_coordinator(**kwargs)
        assert roborock_maps.snapshot(robot) is None

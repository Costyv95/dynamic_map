"""Unit tests for custom_components/dynamic_map/vacuum_map.py.

The module is Home Assistant free, so it is loaded straight from its path.
Run with: python -m pytest tests/
"""
import importlib.util
import io
import os
import sys

import pytest
from PIL import Image

MODULE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "custom_components", "dynamic_map", "vacuum_map.py",
)
spec = importlib.util.spec_from_file_location("dynamic_map_vacuum_map", MODULE_PATH)
vacuum_map = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = vacuum_map   # dataclasses need the module importable
spec.loader.exec_module(vacuum_map)

Box, Reference = vacuum_map.Box, vacuum_map.Reference


def png(size=(1640, 1956), content=(500, 568, 1110, 1422), colour=(19, 87, 148, 255)):
    """A transparent canvas with one opaque rectangle, like a robot map."""
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    if content:
        image.paste(colour, content)
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


class TestContentBox:
    def test_finds_the_drawn_area_and_ignores_the_empty_canvas(self):
        assert vacuum_map.content_box(png()).as_tuple() == (500, 568, 1110, 1422)

    def test_returns_none_for_a_blank_image(self):
        assert vacuum_map.content_box(png(content=None)) is None

    def test_nearly_transparent_pixels_do_not_count_as_content(self):
        faint = png(content=(0, 0, 40, 40), colour=(255, 255, 255, 4))
        assert vacuum_map.content_box(faint) is None


class TestPadBox:
    def test_adds_a_margin_and_widens_to_the_asked_aspect(self):
        box = vacuum_map.pad_box(Box(500, 568, 1110, 1422), (1640, 1956), 1.5, 0.02)
        assert box.width / box.height == pytest.approx(1.5, abs=0.02)
        assert box.left <= 500 and box.top <= 568 and box.right >= 1110 and box.bottom >= 1422

    def test_keeps_the_content_when_the_canvas_is_too_small_to_centre_it(self):
        box = vacuum_map.pad_box(Box(0, 0, 100, 400), (100, 400), 1.5, 0.0)
        assert box.as_tuple() == (0, 0, 100, 400)

    def test_slides_inside_the_canvas_instead_of_running_off_the_edge(self):
        box = vacuum_map.pad_box(Box(0, 300, 60, 380), (400, 400), 1.0, 0.1)
        assert box.left >= 0 and box.bottom <= 400
        assert box.width == box.height

    def test_no_aspect_only_adds_the_margin(self):
        box = vacuum_map.pad_box(Box(100, 100, 200, 300), (1000, 1000), None, 0.1)
        assert box.as_tuple() == (90, 80, 210, 320)


class TestFit:
    def test_crops_the_map_and_carries_the_calibration_with_it(self):
        refs = [Reference(25500, 25500, 572, 1364), Reference(35500, 25500, 1372, 1364)]
        image, moved, box = vacuum_map.fit(png(), refs, aspect=1.5)
        with Image.open(io.BytesIO(image)) as out:
            assert out.size == (box.width, box.height)
            assert out.size[0] / out.size[1] == pytest.approx(1.5, abs=0.02)
            assert out.size[0] < 1640
        # the same house pixel, in the cropped image
        assert moved[0].map_x == 572 - box.left
        assert moved[0].map_y == 1364 - box.top
        # and the drawn area is all still there
        assert box.left <= 500 and box.right >= 1110

    def test_leaves_a_blank_or_already_tight_image_alone(self):
        refs = [Reference(1, 2, 3, 4)]
        blank = png(content=None)
        assert vacuum_map.fit(blank, refs) == (blank, refs, None)
        tight = png(size=(300, 200), content=(0, 0, 300, 200))
        assert vacuum_map.fit(tight, refs)[2] is None

    def test_calibration_points_have_the_shape_the_card_reads(self):
        points = vacuum_map.calibration_points([Reference(25500, 35500, 572.04, 564.0)])
        assert points == [{"vacuum": {"x": 25500, "y": 35500}, "map": {"x": 572.0, "y": 564.0}}]

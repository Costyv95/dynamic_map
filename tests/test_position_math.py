"""Unit tests for custom_components/dynamic_map/position_math.py (#1354).

HA-free; loaded by path like test_storage.py. Run with: python -m pytest tests/
"""
import importlib.util
import os

import pytest

PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "custom_components", "dynamic_map", "position_math.py",
)
spec = importlib.util.spec_from_file_location("dynamic_map_position_math", PATH)
pm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pm)

A, B, C = "aa:aa:aa:aa:aa:01", "aa:aa:aa:aa:aa:02", "aa:aa:aa:aa:aa:03"

# A room 10 x 10 % with a proxy at each of three corners; fingerprints at the
# corners and the middle, readings as a real phone would give them.
ROOM_FPS = [
    {"x": 10, "y": 10, "features": {A: 0.5, B: 6.0, C: 6.0}},
    {"x": 20, "y": 10, "features": {A: 6.0, B: 0.5, C: 8.0}},
    {"x": 10, "y": 20, "features": {A: 6.0, B: 8.0, C: 0.5}},
    {"x": 15, "y": 15, "features": {A: 3.5, B: 3.5, C: 3.5}},
]


class TestReadings:
    @pytest.mark.parametrize("raw,want", [
        ("2.5", 2.5), (0.01, pm.NEAR_M), (99, pm.FAR_M),
        ("unknown", None), ("unavailable", None), (None, None), ("nan", None), (-1, None),
    ])
    def test_clamp_distance(self, raw, want):
        assert pm.clamp_distance(raw) == want

    def test_a_proxy_that_does_not_hear_counts_as_far(self):
        near = {A: 1.0, B: 1.0}
        assert pm.feature_gap(near, {A: 1.0, B: 1.0}) == 0
        assert pm.feature_gap(near, {A: 1.0}) > pm.feature_gap(near, {A: 1.0, B: 2.0})

    def test_fingerprint_is_the_per_proxy_median_of_proxies_heard_half_the_time(self):
        samples = [{A: 1.0, B: 5.0}, {A: 2.0}, {A: 3.0, C: 9.0}, {A: 100.0, B: 7.0}]
        assert pm.median_reading(samples) == {A: 2.5, B: 6.0}   # C heard once of 4: dropped
        assert pm.median_reading([]) == {}


class TestEstimate:
    def test_a_reading_equal_to_a_fingerprint_lands_on_it_with_full_confidence(self):
        hit = pm.estimate(ROOM_FPS, {A: 0.5, B: 6.0, C: 6.0}, k=1)
        assert (hit["x"], hit["y"], hit["confidence"]) == (10, 10, 1.0)

    def test_a_reading_between_two_spots_lands_between_them(self):
        hit = pm.estimate(ROOM_FPS, {A: 1.5, B: 4.5, C: 5.0})
        assert 10 < hit["x"] < 15 and 10 <= hit["y"] < 15

    def test_the_nearest_fingerprint_weighs_most(self):
        hit = pm.estimate(ROOM_FPS, {A: 6.0, B: 0.6, C: 8.0})
        assert abs(hit["x"] - 20) < abs(hit["x"] - 10)

    def test_nothing_to_compare_is_none(self):
        assert pm.estimate([], {A: 1.0}) is None
        assert pm.estimate(ROOM_FPS, {}) is None

    def test_smoothing_glides_and_first_fix_is_direct(self):
        new = {"x": 20.0, "y": 10.0}
        assert pm.smooth(None, new) == new
        assert pm.smooth({"x": 10.0, "y": 10.0}, new, alpha=0.5)["x"] == 15.0


class TestRooms:
    ROOMS = {
        2: [
            {"id": "r_kitchen", "name": "Kitchen", "area_id": "kitchen", "polygon": [[0, 0], [10, 0], [10, 10], [0, 10]]},
            {"id": "r_hall", "name": "Hallway", "area_id": "hallway", "polygon": [[10, 0], [20, 0], [20, 10], [10, 10]]},
        ],
        3: [{"id": "r_terrace", "name": "Terrace", "area_id": "terrace", "polygon": [[0, 0], [50, 0], [50, 50], [0, 50]]}],
    }

    def test_room_at_finds_the_polygon_on_that_floor(self):
        assert pm.room_at(self.ROOMS, 2, 15, 5)["id"] == "r_hall"
        assert pm.room_at(self.ROOMS, 3, 15, 5)["id"] == "r_terrace"
        assert pm.room_at(self.ROOMS, 2, 50, 50) is None

    @pytest.mark.parametrize("area,room", [
        ("Hallway", "r_hall"), ("hallway", "r_hall"), ("kitchen", "r_kitchen"),
        ("Roof garden", "r_terrace"),   # an HA area name that differs from the room name
    ])
    def test_room_for_area(self, area, room):
        floor, found = pm.room_for_area(self.ROOMS, area, {"terrace": "Roof garden"})
        assert found["id"] == room

    @pytest.mark.parametrize("area", ["unknown", "unavailable", "not_home", "", None, "Garage"])
    def test_no_room(self, area):
        assert pm.room_for_area(self.ROOMS, area) == (None, None)

    def test_centre_of_a_square(self):
        assert pm.polygon_centre([[0, 0], [10, 0], [10, 10], [0, 10]]) == [5.0, 5.0]

"""Unit tests for custom_components/dynamic_map/position_math.py (#1354).

HA-free; loaded by path like test_storage.py. Run with: python -m pytest tests/
"""
import importlib.util
import json
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

    def test_silence_matches_a_silent_spot_best(self):
        silent = {"x": 50.0, "y": 50.0, "features": {}}
        assert pm.feature_gap({}, {}) == 0.0
        hit = pm.estimate(ROOM_FPS + [silent], {}, k=1)
        assert (hit["x"], hit["y"], hit["confidence"]) == (50.0, 50.0, 1.0)


class TestTrack:
    """The best spots in the house pick floor and room; Bermuda is the fallback."""

    def fp(self, floor, room, x, y, features):
        return {"floor": floor, "room_id": room, "x": x, "y": y, "features": features}

    def house(self):
        return [
            self.fp(2, "office", 10, 10, {A: 1.0, B: 6.0}),
            self.fp(2, "office", 20, 10, {A: 2.0, B: 5.0}),
            self.fp(2, "kitchen", 70, 70, {A: 8.0, B: 1.0}),
            self.fp(3, "terrace", 40, 40, {}),            # no proxy up there
            self.fp(3, "terrace", 60, 40, {A: 14.0}),
        ]

    def first(self, reading, bermuda=None, fps=None):
        return pm.Track().step(self.house() if fps is None else fps, reading, 0.0, bermuda)

    def test_a_phone_no_proxy_hears_stays_where_it_was(self):
        assert self.first({}) is None                                   # never placed: nowhere
        track = pm.Track()
        placed = track.step(self.house(), {A: 1.0, B: 6.0}, 0.0)
        assert placed[1] == "office"
        assert track.step(self.house(), {}, 5.0) == placed               # locked phone
        assert track.step(self.house(), {}, 3600.0) == placed            # gone out for an hour

    def test_a_good_match_beats_bermudas_room(self):
        floor, room, _ = self.first({A: 7.5, B: 1.1}, bermuda=(2, "office"))
        assert (floor, room) == (2, "kitchen")

    def test_a_poor_match_defers_to_bermuda(self):
        floor, room, hit = self.first({A: 3.0, B: 3.0, C: 0.5}, bermuda=(2, "office"))
        assert (floor, room) == (2, "office") and hit is not None

    def test_never_averages_across_rooms(self):
        _, room, hit = self.first({A: 1.0, B: 6.0})
        assert room == "office" and hit["x"] <= 20

    def test_bermuda_room_without_spots_has_no_estimate(self):
        assert self.first({A: 3.0, B: 3.0, C: 0.5}, bermuda=(1, "hall")) == (1, "hall", None)
        assert self.first({A: 1.0}, fps=[]) is None

    def test_one_stray_reading_does_not_change_room(self):
        track, office, kitchen = pm.Track(), {A: 1.0, B: 6.0}, {A: 8.0, B: 1.0}
        for t in range(10):
            assert track.step(self.house(), office, float(t))[1] == "office"
        assert track.step(self.house(), kitchen, 10.0)[1] == "office"
        assert track.step(self.house(), office, 11.0)[1] == "office"

    def test_walking_into_another_room_switches_within_seconds(self):
        track, office, kitchen = pm.Track(), {A: 1.0, B: 6.0}, {A: 8.0, B: 1.0}
        for t in range(10):
            track.step(self.house(), office, float(t))
        rooms = [track.step(self.house(), kitchen, 10.0 + t)[1] for t in range(10)]
        assert rooms[-1] == "kitchen" and rooms.index("kitchen") <= 6

    def test_the_dot_glides_at_walking_pace_and_first_fix_is_direct(self):
        track = pm.Track()
        _, _, hit = track.step(self.house(), {A: 1.0, B: 6.0}, 0.0)
        assert hit["x"] == pytest.approx(10, abs=0.5)
        x = [track.step(self.house(), {A: 2.0, B: 5.0}, float(t))[2]["x"] for t in range(1, 30)]
        assert all(b >= a for a, b in zip(x, x[1:]))           # heads there steadily
        assert x[0] < 15 and x[-1] == pytest.approx(20, abs=0.5)

    def test_an_offline_proxy_is_left_out_of_every_spot(self):
        # C went down after calibration: live it hears nobody. Counted as FAR it
        # would pull the office reading toward the kitchen, which C never heard.
        fps = [
            self.fp(2, "office", 10, 10, {A: 1.0, B: 6.0, C: 1.0}),
            self.fp(2, "kitchen", 70, 70, {A: 4.0, B: 2.0}),
        ]
        live = {A: 1.2, B: 5.0}
        assert self.first(live, fps=fps)[1] == "kitchen"
        assert self.first(live, fps=pm.drop_scanners(fps, {C}))[1] == "office"
        assert pm.drop_scanners(fps, set()) is fps
        assert fps[0]["features"][C] == 1.0              # the stored spot is untouched

    def test_glide_is_capped_by_speed(self):
        assert pm.glide(None, {"x": 20.0, "y": 10.0}, 1.0) == {"x": 20.0, "y": 10.0}
        step = pm.glide({"x": 0.0, "y": 0.0}, {"x": 100.0, "y": 0.0}, 1.0)
        assert step["x"] == pytest.approx(pm.MAX_SPEED)

    def test_readings_are_pooled_over_the_window(self):
        assert pm.pooled([(0.0, {A: 1.0}), (1.0, {A: 3.0}), (2.0, {A: 2.0})], 2.0) == {A: 2.0}
        assert pm.pooled([(0.0, {A: 9.0}), (10.0, {A: 1.0})], 10.0) == {A: 1.0}   # old reading dropped


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


def test_room_for_area_shared_cases():
    """Same fixture as frontend/tests/AreaRoomCases.test.js (#1708)."""
    fx_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "custom_components", "dynamic_map", "frontend", "tests", "fixtures",
                           "area_room_cases.json")
    with open(fx_path, encoding="utf-8") as fh:
        fx = json.load(fh)
    rooms = {int(f): rs for f, rs in fx["rooms_by_floor"].items()}
    for case in fx["cases"]:
        floor, room = pm.room_for_area(rooms, case["state"], fx["area_names"])
        got = [floor, room["id"]] if room else None
        assert got == case["expect"], case["state"]

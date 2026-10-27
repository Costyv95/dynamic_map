"""Unit tests for custom_components/dynamic_map/radio_model.py. HA-free, loaded by path."""
import importlib.util
import json
import math
import os

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "custom_components", "dynamic_map")


def load(name):
    spec = importlib.util.spec_from_file_location(f"dynamic_map_{name}", os.path.join(ROOT, f"{name}.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


rm, pm = load("radio_model"), load("position_math")
A, B = "aa:00", "bb:00"
# Two rooms side by side, a proxy in each; one wall between them.
ROOMS = [{"id": "west", "polygon": [[0, 0], [50, 0], [50, 100], [0, 100]]},
         {"id": "east", "polygon": [[50, 0], [100, 0], [100, 100], [50, 100]]}]
PROXIES = {A: (25, 50), B: (75, 50)}


def truth(x, y):
    """What a proxy reports: 0.2 m per map %, x3 for each wall crossed."""
    out = {}
    for mac, (px, py) in PROXIES.items():
        d = max(math.hypot(x - px, y - py), 1.0) * 0.2 * (3 if (x < 50) != (px < 50) else 1)
        out[mac] = round(min(d, rm.FAR_M), 2)
    return out


SPOTS = [{"id": f"s{i}", "floor": 2, "x": x, "y": y, "features": truth(x, y)}
         for i, (x, y) in enumerate([(10, 20), (30, 80), (40, 40), (60, 30), (90, 70), (70, 90), (20, 60)])]


def model():
    return rm.build({2: ROOMS}, {2: {"aspect": 1.0, "proxies": PROXIES}}, SPOTS)[2]


def test_a_reading_lands_in_its_room_near_its_spot():
    gaps = model().gaps(truth(85, 20))
    best = min(gaps, key=lambda k: gaps[k][0])
    assert best == (2, "east")
    x, y = gaps[best][1]
    assert math.hypot(x - 85, y - 20) < 15


def test_an_offline_proxy_is_left_out():
    gaps = model().gaps({B: truth(85, 20)[B]}, skip={A})
    assert min(gaps, key=lambda k: gaps[k][0]) == (2, "east")


def test_too_few_spots_or_no_placed_proxies_build_nothing():
    assert rm.build({2: ROOMS}, {2: {"aspect": 1.0, "proxies": PROXIES}}, SPOTS[:3]) == {}
    assert rm.build({2: ROOMS}, {}, SPOTS) == {}


def test_refine_averages_with_the_model_point_or_stands_in_for_it():
    hit = {"x": 10.0, "y": 10.0, "confidence": 0.9, "gap": 0.05, "used": 3}
    assert rm.refine(hit, (0.1, [20.0, 30.0]))["x"] == 15.0
    assert rm.refine(None, (0.1, [20.0, 30.0])) == {"x": 20.0, "y": 30.0, "confidence": 0.8, "gap": 0.1, "used": 0}
    assert rm.refine(hit, None) is hit


def test_track_can_pick_a_room_without_fingerprints_through_the_model():
    m = model()
    west_only = [dict(s, room_id="west") for s in SPOTS if s["x"] < 50]
    track = pm.Track()
    floor, room, hit = track.step(west_only, truth(85, 20), 0.0, None,
                                  lambda r: m.gaps(r), rm.refine)
    assert (floor, room) == (2, "east")
    assert hit["used"] == 0 and hit["x"] > 50


def test_read_proxies(tmp_path):
    cfg = {"canvas": {"w": 1280, "h": 1920}, "ble_proxies": [{"id": A, "name": "a", "position": [10, 20]}, {"id": B}]}
    (tmp_path / "config_floor2.json").write_text(json.dumps(cfg))
    (tmp_path / "config_floor1.json").write_text(json.dumps({"canvas": {}}))
    assert rm.read_proxies(str(tmp_path)) == {2: {"aspect": 1.5, "proxies": {A: (10, 20)}}}

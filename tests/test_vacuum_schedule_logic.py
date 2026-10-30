"""Unit tests for custom_components/dynamic_map/vacuum_schedule_logic.py (pure, no HA)."""
import importlib.util
import os
from datetime import datetime

import pytest

PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "custom_components", "dynamic_map", "vacuum_schedule_logic.py")
spec = importlib.util.spec_from_file_location("vacuum_schedule_logic", PATH)
vs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vs)

ROOMS = {1: "Kitchen", 2: "Bathroom", 3: "Bedroom"}
SELECTS = {"cleaning_mode": "select.c", "mop_intensity": "select.w", "mop_mode": "select.r"}
BASE = {"entity_id": "vacuum.r", "time": "13:00", "days": [1, 3]}


def test_normalize_fills_defaults_and_merges_partial_updates():
    s = vs.normalize(BASE | {"suction": "max", "water": ""})
    assert s["enabled"] and s["rooms"] == [] and s["mode"] == "vac_mop" and s["repeat"] == 1
    assert "water" not in s and len(s["id"]) == 12
    off = vs.normalize({"id": s["id"], "enabled": False}, s)
    assert off["enabled"] is False and off["suction"] == "max" and off["id"] == s["id"]


@pytest.mark.parametrize("bad", [{"time": "25:00"}, {"days": []}, {"days": [7]},
                                 {"mode": "wash"}, {"repeat": 4}, {"entity_id": "light.x"}])
def test_normalize_rejects_bad_fields(bad):
    with pytest.raises(ValueError):
        vs.normalize(BASE | bad)


def test_due_once_in_its_minute_on_its_days_only():
    s = vs.normalize(BASE)
    tue = datetime(2026, 11, 3, 13, 0, 0)
    assert vs.is_due(s, tue)
    assert not vs.is_due(s, tue.replace(minute=1))
    assert not vs.is_due(s, datetime(2026, 11, 2, 13, 0))          # Monday
    assert not vs.is_due(s | {"last_run": tue.isoformat()}, tue)    # already ran
    assert not vs.is_due(s | {"enabled": False}, tue)


def test_next_run_skips_to_next_listed_weekday():
    s = vs.normalize(BASE)
    assert vs.next_run(s, datetime(2026, 11, 3, 13, 0)) == datetime(2026, 11, 5, 13, 0)
    assert vs.next_run(s, datetime(2026, 11, 3, 12, 59)) == datetime(2026, 11, 3, 13, 0)
    assert vs.next_run(s | {"enabled": False}, datetime(2026, 11, 3)) is None


def test_plan_rooms_sets_modes_then_segment_cleans():
    s = vs.normalize(BASE | {"rooms": ["kitchen", "Bedroom"], "suction": "max",
                             "water": "moderate", "route": "deep_plus", "repeat": 2})
    steps = vs.plan(s, SELECTS, ROOMS)
    assert [(d, sv) for d, sv, _ in steps] == [
        ("select", "select_option"), ("vacuum", "set_fan_speed"), ("select", "select_option"),
        ("select", "select_option"), ("vacuum", "send_command")]
    assert steps[0][2]["option"] == "vac_and_mop"
    assert steps[-1][2]["params"] == [{"segments": [1, 3], "repeat": 2}]


def test_plan_whole_house_and_vacuum_only():
    s = vs.normalize(BASE | {"mode": "vacuum", "suction": "turbo", "water": "high"})
    steps = vs.plan(s, SELECTS, ROOMS)
    assert ("select", "select_option", {"entity_id": "select.w", "option": "high"}) not in steps
    assert steps[-1] == ("vacuum", "start", {"entity_id": "vacuum.r"})
    deep = vs.plan(s | {"repeat": 2}, SELECTS, ROOMS)
    assert deep[-1][2]["params"][0]["segments"] == [1, 2, 3]


def test_plan_refuses_unknown_rooms_instead_of_whole_house():
    with pytest.raises(ValueError):
        vs.plan(vs.normalize(BASE | {"rooms": ["Garage"]}), SELECTS, ROOMS)

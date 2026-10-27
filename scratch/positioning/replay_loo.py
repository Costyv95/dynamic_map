"""Leave-one-out through the shipped code: radio_model.build + position_math.Track.step."""
# Usage: copy the HA .storage/dynamic_map.fingerprints to fp.json, rooms_floor2.json to rooms2.json and
# config_floor2.json to cfg2.json in the cwd, then: python replay_loo.py <repo root>
import json, importlib.util, sys, numpy as np
ROOT = sys.argv[1] + "/custom_components/dynamic_map/"
def load(n):
    s = importlib.util.spec_from_file_location(n, ROOT + n + ".py"); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
pm, rm = load("position_math"), load("radio_model")
fps = json.load(open("fp.json"))["data"]["fingerprints"]
rooms = {2: json.load(open("rooms2.json"))}
cfg = json.load(open("cfg2.json"))
placed = {2: {"aspect": cfg["canvas"]["h"] / cfg["canvas"]["w"], "proxies": {p["id"]: tuple(p["position"]) for p in cfg["ble_proxies"]}}}
f2 = [f for f in fps if f["floor"] == 2]
truth = lambda f: (pm.room_at(rooms, 2, f["x"], f["y"]) or {}).get("id") or f["room_id"]
for f in f2: f["room_id"] = truth(f)   # as spots.live_spots: the room the spot sits in
for use_model in (False, True):
    ok, err = 0, []
    for i, f in enumerate(f2):
        train = f2[:i] + f2[i + 1:]
        models = rm.build(rooms, placed, train) if use_model else {}
        model = (lambda r: rm.house_gaps(models, r)) if models else None
        floor, room, hit = pm.Track().step(train, f["features"], 0.0, None, model, rm.refine if models else None)
        ok += room == f["room_id"]
        if hit: err.append(np.hypot(hit["x"] - f["x"], (hit["y"] - f["y"]) * 1.5))
    print("with radio map" if use_model else "fingerprints only", f"room {ok}/{len(f2)}", f"median error {np.median(err):.1f} map-% over {len(err)} placed")

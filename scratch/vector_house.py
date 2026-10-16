#!/usr/bin/env python3
"""One-time migration: the house as vector data instead of scanned plan pictures.

Floors 1 and 2 were DXF scans: rooms in % of bg_floorN.png, with walls,
doors, windows and furniture baked into the picture. This writes them as
data in the same map space (1280 × 1920 map units, the old picture's
pixels), measured off those pictures once:

  config_floorN.json    canvas {w, h}, background 'fit', walls (centre-line
                        polylines with thickness)
  shortcuts_floorN.json decor objects drawn by shared/Furniture.js
                        (config.furniture = kind), doors and windows included

Rooms and every interactive object are kept as they are. Floor 3 was
already drawn by hand; it only gets its canvas. Re-running replaces the
objects this script made (ids starting 'fur_') and nothing else.

Usage: vector_house.py <dynamic_map_data dir>
"""
import json
import math
import os
import sys

EXT, INT = 36, 18          # wall thickness, map units
WALL_COLOR = '#1e293b'
FLOOR_COLOR = '#eeeeee'

# ---------------------------------------------------------------------------
# Walls: centre lines in map units. A free end (at a door or window) is
# pulled back by half the thickness, because walls are stroked with square
# caps; an end that meets another wall runs to that wall's centre line.

FLOORS = {
    1: {
        'canvas': (1280, 1920),
        'walls': [
            (EXT, [(345.5, 614), (345.5, 606.5), (934.5, 606.5), (934.5, 769), (790, 769), (790, 804)]),
            (EXT, [(790, 907), (790, 978), (546.5, 978), (546.5, 1233), (345.5, 1233), (345.5, 963)]),
            (INT, [(345.5, 969), (402, 969)]),
            (INT, [(516, 969), (546.5, 969)]),
        ],
        # (kind, hinge, free jamb, swing direction) on the wall face
        'doors': [
            ('Front door', (365, 770), (365, 632), (1, 0), EXT),
            ('Washroom door', (411, 978), (507, 978), (0, 1), EXT),
            ('Closet door', (772, 822), (772, 889), (-1, 0), EXT),
        ],
        # (name, centre, length, thickness, rotation)
        'windows': [
            ('Front window', (345.5, 857.5), 175, EXT, 90),
        ],
        # (kind, name, centre, (w, h), rotation, opts)
        'furniture': [
            ('stairs', 'Stairs', (783, 687.5), (266, 125), 0, {'steps': 8}),
            ('cabinet', 'Shoe cabinet', (754.5, 796), (68, 35), 90, {}),
            ('counter', 'Counter', (625, 924), (230, 72), 180, {}),
            ('shelf', 'Shelf', (386, 1009), (62, 44), -90, {}),
            ('washbasin', 'Washbasin', (507, 1058.5), (73, 42), 90, {}),
            ('washer', 'Washing machine', (412.5, 1160), (97, 110), 180, {}),
            ('shelf', 'Rack', (494.5, 1180), (67, 70), 180, {}),
        ],
    },
    2: {
        'canvas': (1280, 1920),
        'walls': [
            (EXT, [(130, 182), (98.5, 182), (98.5, 1657), (112, 1657)]),
            (EXT, [(1169, 182), (1189.5, 182), (1189.5, 1657), (1135, 1657)]),
            (EXT, [(328, 1657), (404, 1657)]),
            (EXT, [(581, 1657), (697, 1657)]),
            (EXT, [(868, 1657), (963, 1657)]),
            (INT, [(829, 501), (829, 675)]),
            (INT, [(827, 799), (827, 1001)]),
            (INT, [(827, 884), (1189.5, 884)]),
            (20, [(825, 1116), (825, 1141.5), (1189.5, 1141.5)]),
            (20, [(98.5, 993), (682, 993)]),
            (INT, [(685, 1141.5), (612, 1141.5), (612, 1657)]),
        ],
        'doors': [
            ('Kitchen door', (820, 790), (820, 684), (-1, 0), INT),
            ('Bathroom door', (835, 1010), (835, 1107), (1, 0), 20),
            ('Bedroom door', (603, 1003), (603, 1132), (-1, 0), INT),
            ('Office door', (815, 1151), (694, 1151), (0, 1), 20),
        ],
        'windows': [
            ('Living window', (487, 182), 678, EXT, 0),
            ('Dining window', (988.5, 182), 325, EXT, 0),
            ('Bedroom window', (220, 1657), 180, EXT, 0),
            ('Bedroom window 2', (492.5, 1657), 141, EXT, 0),
            ('Office window', (782.5, 1657), 135, EXT, 0),
            ('Office window 2', (1049, 1657), 136, EXT, 0),
        ],
        'furniture': [
            ('dining_table', 'Dining table', (776, 347.5), (382, 239), 0, {'per_side': 2}),
            ('sofa', 'Living sofa', (482.5, 517.5), (389, 131), 90, {'seats': 3}),
            ('table', 'Coffee table', (336, 520), (88, 176), 0, {}),
            ('tv_unit', 'TV unit', (153.5, 530.5), (255, 73), -90, {}),
            ('shelf', 'Living shelf', (142.5, 296.5), (147, 51), -90, {}),
            ('shelf', 'Log store', (717.5, 587), (180, 49), 90, {'bays': 2}),
            ('fireplace', 'Stove', (780, 586), (128, 76), 90, {}),
            ('cabinet', 'Kitchen cabinet', (882.5, 541), (94, 89), -90, {}),
            ('fridge', 'Fridge', (882.5, 636.5), (97, 89), -90, {}),
            ('wardrobe', 'Pantry', (1129, 424), (156, 82), 90, {'doors': 2}),
            ('counter', 'Kitchen counter', (1127.5, 646), (288, 85), 90, {}),
            ('counter', 'Kitchen counter 2', (1051, 832.5), (238, 85), 180, {}),
            ('hob', 'Oven', (885, 832.5), (94, 85), 180, {}),
            ('cabinet', 'Corner cabinet', (1142.5, 222.5), (55, 45), 0, {}),
            ('stairs', 'Stairs', (393.5, 909), (553, 148), 180, {'steps': 13}),
            ('bathtub', 'Bathtub', (1121, 1012.5), (239, 100), 90, {}),
            ('toilet', 'Toilet', (904.5, 929), (55, 72), 0, {}),
            ('washbasin', 'Washbasin', (989.5, 920.5), (75, 55), 0, {}),
            ('shelf', 'Bathroom shelf', (852.5, 938.5), (83, 35), -90, {'bays': 1}),
            ('wardrobe', 'Bedroom wardrobe', (266, 1048), (298, 90), 0, {}),
            ('bed', 'Bed', (266, 1339), (272, 298), -90, {}),
            ('cabinet', 'Nightstand', (147, 1169), (68, 60), -90, {}),
            ('cabinet', 'Nightstand 2', (147, 1505), (68, 60), -90, {}),
            ('cabinet', 'Dresser', (557.5, 1413), (390, 91), 90, {}),
            ('cabinet', 'Bedroom chest', (366, 1612.5), (112, 49), 180, {}),
            ('shelf', 'Office shelf', (650.5, 1213), (124, 59), -90, {}),
            ('wardrobe', 'Office wardrobe', (650.5, 1456), (362, 59), -90, {}),
            ('sofa', 'Office sofa', (989, 1224.5), (318, 147), 0, {'seats': 3}),
            ('desk', 'Desk', (908.5, 1535), (217, 204), 0, {}),
            ('office_chair', 'Desk chair', (814, 1521.5), (83, 88), -90, {}),
            ('office_chair', 'Desk chair 2', (1018, 1521.5), (83, 88), 90, {}),
            ('cabinet', 'Office cabinet', (1141, 1532), (210, 60), 90, {}),
        ],
    },
    3: {'canvas': (1600, 1000)},
}


def pct(pt, size):
    return [round(pt[0] / size[0] * 100, 4), round(pt[1] / size[1] * 100, 4)]


def oriented(v):
    return {'horizontal': v, 'vertical': v}


def decor(fid, name, kind, centre, wh, rotation, opts, size):
    pos = pct(centre, size)
    sc = {
        'id': fid, 'name': name, 'type': 'generic',
        'position': oriented(pos),
        'scaleX': oriented(round(wh[0] / 24, 4)), 'scaleY': oriented(round(wh[1] / 24, 4)),
        'rotation': oriented(rotation % 360),
        'config': {
            'shape': 'rect', 'transparent': True, 'decor': True, 'autoRotate': True,
            'proportional': False, 'furniture': kind, 'actions': [], 'states': [],
        },
    }
    if opts:
        sc['config']['furniture_opts'] = opts
    return sc


def door_frame(hinge, jamb, swing):
    """Centre, width and rotation/mirror of a door box from its hinge, free
    jamb and swing direction (shared/Furniture.js 'door' geometry)."""
    hx, hy = hinge
    jx, jy = jamb
    w = math.hypot(jx - hx, jy - hy)
    ex = ((jx - hx) / w, (jy - hy) / w)
    nx, ny = swing
    centre = ((hx + jx) / 2 + nx * w / 2, (hy + jy) / 2 + ny * w / 2)
    # Unmirrored: local +x = hinge -> jamb, local +y = -swing.
    theta = math.atan2(ex[1], ex[0])
    ly = (-math.sin(theta), math.cos(theta))
    if abs(ly[0] + nx) < 1e-6 and abs(ly[1] + ny) < 1e-6:
        return centre, w, round(math.degrees(theta)), False
    theta = math.atan2(-ex[1], -ex[0])
    return centre, w, round(math.degrees(theta)), True


def build(floor, model, data_dir):
    size = model['canvas']
    cfg_path = os.path.join(data_dir, f'config_floor{floor}.json')
    cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
    cfg['canvas'] = {'w': size[0], 'h': size[1]}
    cfg['background_mode'] = 'fit'
    if 'walls' in model:
        cfg['background_color'] = FLOOR_COLOR
        cfg['walls'] = [
            {'id': f'wall_f{floor}_{i + 1}', 'points': [pct(p, size) for p in pts], 'thickness': t, 'color': WALL_COLOR}
            for i, (t, pts) in enumerate(model['walls'])
        ]
    with open(cfg_path, 'w') as f:
        json.dump(cfg, f, indent=2)

    if 'furniture' not in model:
        return
    sc_path = os.path.join(data_dir, f'shortcuts_floor{floor}.json')
    shortcuts = [s for s in json.load(open(sc_path)) if not str(s.get('id', '')).startswith('fur_')]
    made = []
    for i, (kind, name, centre, wh, rot, opts) in enumerate(model['furniture']):
        made.append(decor(f'fur_f{floor}_{i + 1}_{kind}', name, kind, centre, wh, rot, opts, size))
    for i, (name, hinge, jamb, swing, wall_t) in enumerate(model.get('doors', [])):
        centre, w, rot, mirror = door_frame(hinge, jamb, swing)
        opts = {'mirror': True} if mirror else {}
        made.append(decor(f'fur_f{floor}_door{i + 1}', name, 'door', centre, (w, w), rot, opts, size))
    for i, (name, centre, length, t, rot) in enumerate(model.get('windows', [])):
        made.append(decor(f'fur_f{floor}_win{i + 1}', name, 'window', centre, (length, t), rot, {}, size))
    # Decor first: it draws beneath the badges either way, and the file reads plan-first.
    with open(sc_path, 'w') as f:
        json.dump(made + shortcuts, f, indent=2)
    print(f'floor {floor}: {len(cfg.get("walls", []))} walls, {len(made)} decor objects, {len(shortcuts)} kept')


if __name__ == '__main__':
    data_dir = sys.argv[1]
    for floor, model in FLOORS.items():
        build(floor, model, data_dir)

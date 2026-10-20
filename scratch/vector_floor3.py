"""Floor 3 (terrace) in the vector style of floors 1 and 2: thick walls in
the shared wall colour, and decor drawn from furniture kinds, not pictures."""
import json, math, sys, os
W, H = 1600, 1000
WALL, FLOOR = '#1e293b', '#eeeeee'
EXT, INT, RAIL = 18, 10, 5
src, out = sys.argv[1], sys.argv[2]

def px(x, y): return [round(x / W * 100, 4), round(y / H * 100, 4)]
def ori(v): return {'horizontal': v, 'vertical': v}

# Room edges (canvas px) from rooms_floor3.json.
L, T, R, B = 189.1, 230.8, 694.6, 956.0   # terrace
SR, ST = 787.8, 428.5                    # stairs right edge, stairs top
DOOR_BOT = 518.8                         # terrace door: x=R, y ST..DOOR_BOT
o = EXT / 2
walls = [
    (EXT, [(R + o, ST - o), (R + o, T - o), (L - o, T - o), (L - o, B + o), (SR + o, B + o), (SR + o, ST - o), (R + o, ST - o)]),
    (INT, [(R, DOOR_BOT), (R, B)]),
    (RAIL, [(549, 426.5), (R - INT / 2, 426.5)]),
]
cfg = json.load(open(os.path.join(src, 'config_floor3.json')))
cfg.pop('horizontal_flip', None); cfg.pop('vertical_flip', None)
cfg['background_color'] = FLOOR
cfg['walls'] = [{'id': f'wall_f3_{i + 1}', 'points': [px(*p) for p in pts], 'thickness': t, 'color': WALL}
                for i, (t, pts) in enumerate(walls)]

def door_frame(hinge, jamb, swing):
    hx, hy = hinge; jx, jy = jamb
    w = math.hypot(jx - hx, jy - hy); ex = ((jx - hx) / w, (jy - hy) / w); nx, ny = swing
    centre = ((hx + jx) / 2 + nx * w / 2, (hy + jy) / 2 + ny * w / 2)
    th = math.atan2(ex[1], ex[0]); ly = (-math.sin(th), math.cos(th))
    if abs(ly[0] + nx) < 1e-6 and abs(ly[1] + ny) < 1e-6: return centre, w, round(math.degrees(th)) % 360, False
    th = math.atan2(-ex[1], -ex[0]); return centre, w, round(math.degrees(th)) % 360, True

dc, dw, drot, dmir = door_frame((R - INT / 2, ST), (R - INT / 2, DOOR_BOT), (-1, 0))
# id -> (kind, (w, h) canvas px, rotation, opts, centre override in px or None)
KIND = {
    'sc_decor_table':     ('dining_table', (112, 92), 90, {'per_side': 1}, None),
    'sc_decor_bbq':       ('grill', (86, 46), 0, {}, None),
    'sc_decor_door':      ('door', (dw, dw), drot, {'mirror': True} if dmir else {}, dc),
    'sc_decor_couch':     ('sofa', (140, 72), 90, {'seats': 3}, None),
    'sc_decor_ctable':    ('table', (52, 52), 0, {'round': True}, None),
    'sc_decor_pot1':      ('plant', (55, 55), 0, {}, None),
    'sc_decor_pot2':      ('plant', (55, 55), 0, {}, None),
    'sc_decor_plantplot': ('planter', (122, 58), 90, {'plants': 3}, None),
    'sc_1783677919806':   ('planter', (122, 58), 90, {'plants': 3}, None),
    'sc_1783677922331':   ('planter', (122, 58), 90, {'plants': 3}, None),
    'sc_1789214118376':   ('planter', (140, 52), 0, {'plants': 4}, None),
    'sc_decor_stairs':    ('stairs', (520, 84), 270, {}, (741.2, 693)),
}
scs = json.load(open(os.path.join(src, 'shortcuts_floor3.json')))
done = []
for s in scs:
    k = KIND.get(s['id'])
    if not k: continue
    kind, (w, h), rot, opts, centre = k
    pos = px(*centre) if centre else (s['position']['horizontal'] if s['id'] == 'sc_1789214118376' else s['position']['vertical'])
    s['position'] = ori(pos)
    s['scaleX'] = ori(round(w / 24, 4)); s['scaleY'] = ori(round(h / 24, 4)); s['rotation'] = ori(rot % 360)
    s.pop('scale', None)
    c = s['config']
    for key in ('image', 'image_tiling', 'color'): c.pop(key, None)
    c.update({'shape': 'rect', 'transparent': True, 'decor': True, 'autoRotate': True, 'proportional': False,
              'furniture': kind, 'actions': [], 'states': []})
    c.pop('furniture_opts', None)
    if opts: c['furniture_opts'] = opts
    done.append(s['id'])
missing = set(KIND) - set(done)
assert not missing, missing
os.makedirs(out, exist_ok=True)
json.dump(cfg, open(os.path.join(out, 'config_floor3.json'), 'w'), indent=2)
json.dump(scs, open(os.path.join(out, 'shortcuts_floor3.json'), 'w'), indent=2)
print('walls', len(walls), 'decor', len(done), 'of', len(scs), 'door', [round(v, 1) for v in dc], round(dw, 1), drot, dmir)

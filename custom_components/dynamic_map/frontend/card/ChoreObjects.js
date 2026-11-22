import { roomChores, sortedChores, choreState, CHORE_MARKS } from './Chores.js?v=3.2.1';
import { roomBox } from '../core/RoomLabels.js?v=3.2.1';
import { chorePeople, selectedPerson } from './ChoreWho.js?v=3.2.1';
import { choreBusy, completeChore } from './ChoresPanel.js?v=3.2.1';
import { uprightTransform } from './RoomAlerts.js?v=3.2.1';

/**
 * Chore marks: in Chores mode every chore gets a round mark coloured by
 * its freshness (Chores.js CHORE_MARKS), on the furniture it is about
 * ("Change bedsheets" → the bed) or under the room's name. In the open room
 * a tap credits the person picked in the who switch, like the panel's Done
 * button. The match is by title keywords → furniture kind, among furniture
 * shortcuts whose centre lies in the room; with several candidates the one
 * whose name shares a word with the title wins ("coffee table").
 */
const KIND_WORDS = [
    [/\bbed(?!room)|sheets?\b|duvet|pillows?\b|mattress/, ['bed']],
    [/\btables?\b/, ['table', 'dining_table']],
    [/\bdesks?\b/, ['desk']],
    [/toilet|\bwc\b/, ['toilet']],
    [/\btubs?\b|bathtub|\bbath\b|shower/, ['bathtub']],
    [/\bsinks?\b|basin/, ['washbasin', 'sink']],
    [/fridge|refrigerator|freezer/, ['fridge']],
    [/fireplace|\bstove\b|chimney/, ['fireplace']],
    [/closets?\b|wardrobes?\b|pantry/, ['wardrobe']],
    [/cabinets?\b|cupboards?\b|drawers?\b|dresser|nightstands?\b/, ['cabinet']],
    [/counters?\b|countertops?\b|worktops?\b/, ['counter']],
    [/\bstairs?\b|\bsteps\b/, ['stairs']],
    [/cushions?\b|\bsofas?\b|couch/, ['sofa']],
    [/\boven\b|\bhob\b|cooktop/, ['hob']],
    [/washing machine|\bwasher\b|laundry/, ['washer']],
    [/shel(f|ves)\b/, ['shelf']],
    [/windows?\b|\bsills?\b/, ['window']],
    [/\btv\b/, ['tv_unit']],
    [/\bdoors?\b/, ['door']],
    [/\bgrill\b|\bbbq\b|barbecue/, ['grill']],
    [/plants?\b|planters?\b|\bpots?\b/, ['planter', 'plant']]
];

const words = (s) => String(s || '').toLowerCase().match(/[a-z]{3,}/g) || [];

/** Furniture kinds a chore title points at ([] when none). */
export function choreKinds(title) {
    const t = String(title || '').toLowerCase();
    return KIND_WORDS.filter(([re]) => re.test(t)).flatMap(([, kinds]) => kinds);
}

function inPolygon(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** Distance from (x, y) to the polygon's outline. */
function edgeDistance(x, y, pts) {
    let best = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [ax, ay] = pts[j], [bx, by] = pts[i];
        const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
        const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
        best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return best;
}

// Windows and doors sit in the wall, just outside the room's outline.
const IN_WALL = ['window', 'door'];
const WALL_SLACK = 0.025;   // of the image width

/** Furniture in a room: [{id, name, kind, x, y}] in map units, from the drawn shortcuts. */
export function roomFurniture(host, room) {
    if (!room || !Array.isArray(room.polygon) || room.polygon.length < 3) return [];
    const poly = room.polygon.map(([px, py]) => [px / 100 * host.imgW, py / 100 * host.imgH]);
    return (host.shortcuts || []).flatMap(sc => {
        const kind = sc && sc.config && sc.config.furniture;
        const el = kind && host.shortcutElements ? host.shortcutElements[sc.id] : null;
        if (!el || !Number.isFinite(el.px) || !Number.isFinite(el.py)) return [];
        const inside = inPolygon(el.px, el.py, poly)
            || (IN_WALL.includes(kind) && edgeDistance(el.px, el.py, poly) <= host.imgW * WALL_SLACK);
        if (!inside) return [];
        return [{ id: sc.id, name: sc.name || '', kind, x: el.px, y: el.py }];
    });
}

/** The furniture a chore is about, or null. */
export function choreObject(chore, furniture) {
    const kinds = choreKinds(chore && chore.title);
    if (!kinds.length) return null;
    const title = new Set(words(chore.title));
    let best = null, bestScore = -1;
    furniture.forEach(f => {
        if (!kinds.includes(f.kind)) return;
        const score = words(f.name).filter(w => title.has(w)).length;
        if (score > bestScore) { best = f; bestScore = score; }
    });
    return best;
}

export function buildChoreObjects(host) {
    host.choreObjects = null;
    host._choreObjSig = null;
    host._choreFurn = null;
    if (!host.mapRoot) return;
    host.choreObjects = document.createElementNS(host.svgNS, 'g');
    host.choreObjects.classList.add('dm-chore-objects');
    host.mapRoot.appendChild(host.choreObjects);
}

/** Radius in map units that is ~14 px on screen at the room's zoom. */
function checkRadius(host) {
    const vb = host._zoomTargetVb || host.defaultVb;
    const pxW = host.svg && host.svg.getBoundingClientRect ? host.svg.getBoundingClientRect().width : 0;
    return vb && vb.w > 0 && pxW > 0 ? 14 * vb.w / pxW : host.imgW * 0.012;
}

/** roomFurniture, cached per room until the drawn shortcuts change. */
function furnitureOf(host, room) {
    const n = Object.keys(host.shortcutElements || {}).length;
    if (!host._choreFurn || host._choreFurn.n !== n) host._choreFurn = { n, rooms: {} };
    const c = host._choreFurn.rooms;
    return c[room.id] || (c[room.id] = roomFurniture(host, room));
}

/**
 * Spots for `count` marks with no furniture: rows under the room's name as
 * seen on screen, wrapped to the room's width. Offsets are laid out
 * upright and mapped back through the marks' upright transform, so a
 * rotated or mirrored map still gets them below the label.
 */
export function roomSpots(host, room, r, count) {
    const box = roomBox(room, host.imgW, host.imgH);
    const rot = !!host.isRotated, sx = host.mapScaleX || 1, sy = host.mapScaleY || 1;
    const W = rot ? box.h : box.w, H = rot ? box.w : box.h;
    const toMap = (x, y) => (rot ? [sx * y, -sy * x] : [sx * x, sy * y]);
    const step = r * 2.3;
    const perRow = Math.max(1, Math.min(count, Math.floor(W / step) || 1));
    const y0 = Math.max(r * 1.2, Math.min(H / 2 - r * 1.4, r * 2.6));
    return Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / perRow), col = i % perRow;
        const inRow = Math.min(perRow, count - row * perRow);
        const [dx, dy] = toMap((col - (inRow - 1) / 2) * step, y0 + row * step);
        return { x: box.cx + dx, y: box.cy + dy };
    });
}

/**
 * Chores mode: every chore of every room on the floor gets a mark coloured
 * by its freshness, on its furniture when one matches, else in a row under
 * the room's name. In the open room a tap credits the picked person; on the
 * overview a tap opens the room. Redrawn only when something shown changed.
 */
export function updateChoreObjects(host, hass, now = new Date()) {
    const layer = host.choreObjects;
    if (!layer) return;
    const open = host._roomPanelRoom;
    const rooms = host.mapMode === 'chores' && hass ? (host.rooms || []) : [];
    const person = rooms.length ? selectedPerson(host, chorePeople(host, hass)) : null;
    const r = checkRadius(host);
    const items = [];
    rooms.forEach(room => {
        const entry = roomChores(host, hass, room);
        const chores = sortedChores(entry);
        if (!chores.length) return;
        const furniture = furnitureOf(host, room);
        const perObject = {};
        const loose = [];
        chores.forEach(chore => {
            const busy = !!choreBusy(host, chore);
            const it = { chore, room, open: !!open && open.id === room.id, busy, state: busy ? 'done' : choreState(chore, now) };
            const f = choreObject(chore, furniture);
            if (!f) { loose.push(it); return; }
            const slot = perObject[f.id] = (perObject[f.id] || 0) + 1;
            items.push({ ...it, at: f, x: f.x + (slot - 1) * r * 2.3, y: f.y });
        });
        roomSpots(host, room, r, loose.length).forEach((p, i) => items.push({ ...loose[i], at: { id: `room:${room.id}`, name: room.name || '' }, ...p }));
    });
    const rank = { ok: 0, done: 1, soon: 2, late: 3 };
    items.sort((a, b) => rank[a.state] - rank[b.state]);   // the urgent ones drawn last, on top
    const sig = [open && open.id, r.toFixed(1), person && person.id, host.isRotated, host.mapScaleX, host.mapScaleY,
        ...items.map(it => `${it.chore.id}@${it.at.id}${it.state}${it.open ? 'o' : ''}${it.busy ? 'b' : ''}${it.chore.title}`)].join('|');
    if (sig === host._choreObjSig) return;
    host._choreObjSig = sig;
    const upright = uprightTransform(host);
    layer.replaceChildren(...items.map(it => markEl(host, it, person, r, upright)));
}

function markEl(host, { chore, room, at, x, y, state, open, busy }, person, r, upright) {
    const ns = host.svgNS;
    const mark = CHORE_MARKS[state] || CHORE_MARKS.ok;
    const g = document.createElementNS(ns, 'g');
    g.classList.add('dm-chore-obj', `dm-chore-${state}`);
    if (busy) g.classList.add('dm-busy');
    g.dataset.chore = String(chore.id);
    g.dataset.object = at.id;
    g.dataset.state = state;
    g.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)})${upright}`);
    const rr = state === 'ok' ? r * 0.75 : r;   // "not due yet" stays quiet
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('r', rr.toFixed(1));
    c.setAttribute('fill', mark.color);
    c.setAttribute('stroke', 'rgba(255,255,255,0.95)');
    c.setAttribute('stroke-width', (r * 0.16).toFixed(1));
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('font-size', (r * 1.2).toFixed(1));
    t.setAttribute('font-weight', '700');
    t.setAttribute('fill', 'white');
    t.textContent = mark.glyph;
    const tip = document.createElementNS(ns, 'title');
    const where = at.name && !at.id.startsWith('room:') ? ` (${at.name})` : '';
    tip.textContent = busy ? `${chore.title}: sent`
        : `${chore.title}${where} · ${mark.label}${open && person ? ` · tap: done by ${person.name}` : ''}`;
    g.append(tip, c, t);
    g.addEventListener('pointerdown', e => e.stopPropagation());
    g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!open) { if (host.onRoomTap) host.onRoomTap(room); return; }   // overview: open the room first
        if (!busy) completeChore(host, chore, selectedPerson(host, chorePeople(host, host._hass)));   // the pick at tap time
    });
    return g;
}

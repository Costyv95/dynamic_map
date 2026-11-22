import { roomChores, sortedChores, choreStatus, levelColor } from './Chores.js?v=3.2.1';
import { chorePeople, selectedPerson } from './ChoreWho.js?v=3.2.1';
import { choreBusy, completeChore } from './ChoresPanel.js?v=3.2.1';
import { uprightTransform } from './RoomAlerts.js?v=3.2.1';

/**
 * Object checks: in Chores mode, a chore about a piece of furniture in the
 * open room ("Change bedsheets" → the bed) gets a round ✓ on that object.
 * A tap credits the person picked in the who switch, like the panel's Done
 * button. The match is by title keywords → furniture kind, among furniture
 * shortcuts whose centre lies in the room; with several candidates the one
 * whose name shares a word with the title wins ("coffee table"). Chores
 * with no match stay list-only.
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

/** Draw the checks for the open room (Chores mode only); redrawn only when something shown changed. */
export function updateChoreObjects(host, hass, now = new Date()) {
    const layer = host.choreObjects;
    if (!layer) return;
    const room = host.mapMode === 'chores' ? host._roomPanelRoom : null;
    const entry = room && hass ? roomChores(host, hass, room) : null;
    const furniture = entry ? roomFurniture(host, room) : [];
    const person = entry ? selectedPerson(host, chorePeople(host, hass)) : null;
    const r = checkRadius(host);
    const items = [];
    const perObject = {};
    sortedChores(entry).forEach(chore => {
        const f = choreObject(chore, furniture);
        if (!f) return;
        const i = perObject[f.id] = (perObject[f.id] || 0) + 1;
        items.push({ chore, f, slot: i - 1, level: choreStatus(chore, now).level, busy: choreBusy(host, chore) });
    });
    const sig = [room && room.id, r.toFixed(1), person && person.id, host.isRotated, host.mapScaleX, host.mapScaleY,
        ...items.map(it => `${it.chore.id}@${it.f.id}${it.level}${it.busy ? 'b' : ''}${it.chore.title}`)].join('|');
    if (sig === host._choreObjSig) return;
    host._choreObjSig = sig;
    const upright = uprightTransform(host);
    layer.replaceChildren(...items.map(it => checkEl(host, it, person, r, upright)));
}

function checkEl(host, { chore, f, slot, level, busy }, person, r, upright) {
    const ns = host.svgNS;
    const g = document.createElementNS(ns, 'g');
    g.classList.add('dm-chore-obj');
    if (busy) g.classList.add('dm-busy');
    g.dataset.chore = String(chore.id);
    g.dataset.object = f.id;
    const x = f.x + slot * r * 2.3;
    g.setAttribute('transform', `translate(${x.toFixed(1)}, ${f.y.toFixed(1)})${upright}`);
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('r', r.toFixed(1));
    c.setAttribute('fill', levelColor(busy ? 'calm' : level));
    c.setAttribute('stroke', 'rgba(255,255,255,0.95)');
    c.setAttribute('stroke-width', (r * 0.16).toFixed(1));
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('font-size', (r * 1.2).toFixed(1));
    t.setAttribute('font-weight', '700');
    t.setAttribute('fill', 'white');
    t.textContent = '✓';
    const tip = document.createElementNS(ns, 'title');
    tip.textContent = busy ? `${chore.title}: sent` : `${chore.title} (${f.name})${person ? ` · tap: done by ${person.name}` : ''}`;
    g.append(tip, c, t);
    g.addEventListener('pointerdown', e => e.stopPropagation());
    g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!busy) completeChore(host, chore, selectedPerson(host, chorePeople(host, host._hass)));   // the pick at tap time
    });
    return g;
}

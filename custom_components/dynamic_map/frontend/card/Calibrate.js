import { zoomToRoom } from './RoomFocus.js?v=3.2.1';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Calibrate positions (#1354): 📍 next to the floor chips, for admins only.
 * A guided flow so it needs no explaining:
 *   1. pick who is carrying the phone (defaults to the logged-in person's),
 *   2. tap the room you are standing in: the map zooms into it,
 *   3. stand still and tap exactly where you are: ~20 s of every Bluetooth
 *      proxy's reading is recorded there (dynamic_map.record_fingerprint),
 *   4. take a few steps and repeat; 3–5 spots per room is plenty.
 * From then on the phone's dot is placed inside the room by comparing live
 * readings with the recorded spots. The room list doubles as a room picker
 * for rooms the panel covers on a phone. Spots show as rings; tap one twice to
 * delete it. While calibrating, taps never reach rooms or devices, but
 * pan and pinch-zoom still work.
 */

const SECONDS = 20;
export const ENOUGH_SPOTS = 3;

export function buildCalibrate(host) {
    const hass = host._hass;
    if (!host.topLeftUI || !hass || !hass.user || !hass.user.is_admin || !hass.callWS) return;
    if (host.config && host.config.calibrate === false) return;
    const btn = document.createElement('button');
    btn.className = 'dm-icon-btn dm-calib-btn' + (host._calib ? ' active' : '');
    btn.title = 'Calibrate positions';
    btn.textContent = '📍';
    btn.addEventListener('click', (e) => { e.stopPropagation(); host._calib ? stopCalibrate(host) : startCalibrate(host); });
    host.topLeftUI.appendChild(btn);
    // A floor switch rebuilds the card; carry on calibrating on the new floor.
    if (host._calib) { host._calib.room = null; mount(host); }
}

export async function startCalibrate(host) {
    host._calib = { tracker: null, trackers: [], fingerprints: [], busy: false, room: null, note: '', left: 0, saved: null };
    const btn = host.renderRoot && host.renderRoot.querySelector('.dm-calib-btn');
    if (btn) btn.classList.add('active');
    if (host.focusedRoomId && host.zoomOutToDefault) host.zoomOutToDefault();
    mount(host);
    await refresh(host);
}

export function stopCalibrate(host) {
    const zoomed = host._calib && host._calib.room;
    unmount(host);
    host._calib = null;
    const btn = host.renderRoot && host.renderRoot.querySelector('.dm-calib-btn');
    if (btn) btn.classList.remove('active');
    if (zoomed && host.zoomOutToDefault) host.zoomOutToDefault();
}

/** The tracker whose name starts like the logged-in user's first name, else the first one. */
export function defaultTracker(trackers, user) {
    const first = ((user && user.name) || '').trim().split(/\s+/)[0].toLowerCase();
    const mine = first && trackers.find(t => (t.name || '').toLowerCase().startsWith(first));
    return (mine || trackers[0] || {}).entity_id || null;
}

/** Ray casting; polygon is [[x, y], ...] in map percent. */
export function roomAtPercent(rooms, x, y) {
    for (const room of rooms || []) {
        const poly = room.polygon || [];
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const [xi, yi] = poly[i], [xj, yj] = poly[j];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) return room;
    }
    return null;
}

async function refresh(host) {
    const c = host._calib;
    if (!c) return;
    try {
        const data = await host._hass.callApi('GET', 'dynamic_map/fingerprints');
        c.trackers = (data.trackers || []).filter(t => t.entity_id);
        c.fingerprints = data.fingerprints || [];
        if (!c.tracker || !c.trackers.some(t => t.entity_id === c.tracker)) c.tracker = defaultTracker(c.trackers, host._hass.user);
        if (!c.trackers.length) c.note = 'No phone is tracked by Bermuda yet.';
    } catch (err) {
        c.note = `Could not load calibration: ${err && err.message ? err.message : err}`;
    }
    render(host);
}

function mount(host) {
    unmount(host);
    const c = host._calib;
    const panel = document.createElement('div');
    panel.className = 'dm-calib';
    for (const t of ['pointerdown', 'click', 'wheel', 'touchstart']) panel.addEventListener(t, e => e.stopPropagation());
    host.renderRoot.appendChild(panel);
    c.panel = panel;
    host.classList.add('dm-calibrating');

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.classList.add('dm-calib-layer');
    host.mapRoot.appendChild(layer);
    c.layer = layer;

    // Capture phase, clicks only: a tap while calibrating picks a room or marks
    // a spot and never opens a room or a device; pans and pinches still work.
    c.onTap = (e) => {
        if (!host._calib) return;
        e.stopPropagation();
        e.preventDefault();
        if (host._cameraDragged) return;
        const ring = e.target && e.target.closest && e.target.closest('.dm-calib-spot');
        if (ring) { remove(host, ring.dataset.id); return; }
        const p = toMapPercent(host, e.clientX, e.clientY);
        if (p) tap(host, p);
    };
    host.svg.addEventListener('click', c.onTap, true);
    render(host);
}

function unmount(host) {
    const c = host._calib;
    if (!c) return;
    if (c.panel) c.panel.remove();
    if (c.layer) c.layer.remove();
    if (c.onTap && host.svg) host.svg.removeEventListener('click', c.onTap, true);
    host.classList.remove('dm-calibrating');
    c.panel = c.layer = c.onTap = null;
}

/** Screen point → map percent of the floor, or null off the floor. */
export function toMapPercent(host, clientX, clientY) {
    const ctm = host.mapRoot && host.mapRoot.getScreenCTM && host.mapRoot.getScreenCTM();
    if (!ctm || !host.imgW || !host.imgH) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const x = (pt.x / host.imgW) * 100, y = (pt.y / host.imgH) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

/** First tap picks the room and zooms in; taps inside that room record a spot. */
function tap(host, p) {
    const c = host._calib;
    if (!c || c.busy) return;
    const room = roomAtPercent(host.rooms, p.x, p.y);
    if (!room) { c.note = 'That is outside every room. Tap inside the room you are in.'; render(host); return; }
    if (!c.room || c.room.id !== room.id) { pickRoom(host, room); return; }
    record(host, p);
}

function pickRoom(host, room) {
    const c = host._calib;
    if (!c || c.busy || !room) return;
    c.room = room;
    c.saved = null;
    c.note = '';
    zoomToRoom(host, room);
    render(host);
}

async function record(host, p) {
    const c = host._calib;
    if (!c.tracker) { c.note = 'Pick whose phone you are carrying first.'; render(host); return; }
    c.busy = true;
    c.note = '';
    c.saved = null;
    c.pending = { x: p.x, y: p.y };
    c.left = SECONDS;
    render(host);
    const tick = setInterval(() => { c.left = Math.max(0, c.left - 1); if (host._calib) render(host); }, 1000);
    try {
        const res = await host._hass.callWS({
            type: 'call_service', domain: 'dynamic_map', service: 'record_fingerprint',
            service_data: { entity_id: c.tracker, floor: Number(host.activeFloor), x: p.x, y: p.y, seconds: SECONDS },
            return_response: true
        });
        const r = (res && res.response) || {};
        c.saved = { room: r.room || (c.room && c.room.name) || 'the room', proxies: r.proxies || 0 };
    } catch (err) {
        c.note = `Not saved: ${err && err.message ? err.message : err}`;
    } finally {
        clearInterval(tick);
        c.busy = false;
        c.pending = null;
    }
    await refresh(host);
}

async function remove(host, id) {
    const c = host._calib;
    if (!c || c.busy || !id) return;
    if (c.confirmDelete !== id) { c.confirmDelete = id; c.note = 'Tap the red ring again to delete that spot.'; render(host); return; }
    c.confirmDelete = null;
    try {
        await host._hass.callWS({ type: 'call_service', domain: 'dynamic_map', service: 'delete_fingerprint', service_data: { id }, return_response: true });
        c.note = 'Spot deleted.';
    } catch (err) {
        c.note = `Not deleted: ${err && err.message ? err.message : err}`;
    }
    await refresh(host);
}

/** Spots per room on this floor, in the floor's room order. */
export function roomProgress(rooms, fingerprints, floor) {
    const here = fingerprints.filter(f => String(f.floor) === String(floor));
    return (rooms || []).filter(r => r.name).map(r => ({
        id: r.id, name: r.name,
        spots: here.filter(f => f.room === r.id || f.room === r.name).length
    }));
}

/** What to tell the person now: [step number, headline, detail]. */
export function stepText(c) {
    const name = c.room && c.room.name;
    if (c.busy) return [3, `Hold still… ${c.left} s`, 'Keep the phone where it is. Recording what every Bluetooth proxy hears.'];
    if (c.saved) {
        const heard = c.saved.proxies
            ? `${c.saved.proxies} ${c.saved.proxies === 1 ? 'proxy' : 'proxies'} heard the phone.`
            : 'No proxy hears the phone here, and that silence is saved as this spot (fine on a floor without proxies).';
        return [4, `Saved in ${c.saved.room} ✓`, `${heard} Take 2–3 steps, stand still and tap your new spot. Tap another room to move on.`];
    }
    if (name) return [2, `Tap exactly where you stand in ${name}`, 'Stand still first. Then you have 20 seconds of keeping still.'];
    return [1, 'Tap the room you are in', 'On the map or in the list below. The map zooms in so you can tap your exact spot.'];
}

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

function render(host) {
    const c = host._calib;
    if (!c || !c.panel) return;
    c.panel.replaceChildren();

    const head = el('div', 'dm-calib-head');
    head.append(el('div', 'dm-calib-title', '📍 Calibrate positions'));
    const done = el('button', 'dm-calib-done', 'Done');
    done.addEventListener('click', () => stopCalibrate(host));
    head.append(done);

    const who = el('div', 'dm-calib-who');
    who.append(el('span', 'dm-calib-label', 'Carrying'));
    for (const t of c.trackers) {
        const chip = el('button', 'dm-calib-chip' + (t.entity_id === c.tracker ? ' active' : ''), (t.name || t.entity_id).replace(/\s*\(BLE\)\s*$/i, ''));
        chip.disabled = c.busy;
        chip.title = `${t.proxies} proxies hear it`;
        chip.addEventListener('click', () => { c.tracker = t.entity_id; render(host); });
        who.append(chip);
    }

    const [n, headline, detail] = stepText(c);
    const step = el('div', 'dm-calib-step');
    step.append(el('div', 'dm-calib-num' + (c.busy ? ' busy' : '') + (c.saved && !c.busy ? ' ok' : ''), c.saved && !c.busy ? '✓' : String(Math.min(n, 3))));
    const words = el('div', 'dm-calib-words');
    words.append(el('div', 'dm-calib-headline', headline), el('div', 'dm-calib-detail', c.note || detail));
    step.append(words);
    if (c.busy) {
        const bar = el('div', 'dm-calib-bar');
        const fill = el('div', 'dm-calib-fill');
        fill.style.width = `${Math.round(100 * (SECONDS - c.left) / SECONDS)}%`;
        bar.append(fill);
        words.append(bar);
    }

    const rooms = el('div', 'dm-calib-rooms');
    for (const r of roomProgress(host.rooms, c.fingerprints, host.activeFloor)) {
        const chip = el('button', 'dm-calib-room' + (r.spots >= ENOUGH_SPOTS ? ' ok' : r.spots ? ' some' : '') + (c.room && c.room.id === r.id ? ' here' : ''),
            `${r.name} ${r.spots >= ENOUGH_SPOTS ? '✓' : `${r.spots}/${ENOUGH_SPOTS}`}`);
        chip.disabled = c.busy;
        chip.addEventListener('click', () => pickRoom(host, (host.rooms || []).find(x => x.id === r.id)));
        rooms.append(chip);
    }

    c.panel.append(head, who, step, rooms);
    drawSpots(host);
}

function drawSpots(host) {
    const c = host._calib;
    if (!c || !c.layer) return;
    const spots = c.fingerprints.filter(f => String(f.floor) === String(host.activeFloor));
    c.layer.replaceChildren();
    const r = host.imgW * (c.room ? 0.008 : 0.012);
    const ring = (x, y, cls, id) => {
        const e = document.createElementNS(SVG_NS, 'circle');
        e.setAttribute('cx', ((x / 100) * host.imgW).toFixed(1));
        e.setAttribute('cy', ((y / 100) * host.imgH).toFixed(1));
        e.setAttribute('r', r.toFixed(1));
        e.setAttribute('class', cls);
        if (id) e.dataset.id = id;
        c.layer.appendChild(e);
    };
    for (const s of spots) ring(s.x, s.y, 'dm-calib-spot' + (c.confirmDelete === s.id ? ' doomed' : ''), s.id);
    if (c.pending) ring(c.pending.x, c.pending.y, 'dm-calib-pending');
}

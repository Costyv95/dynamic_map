import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.1';

/**
 * Presence dots: card config `presence: [{entity, name?, color?}]` where
 * each entity's state names the room (room name, HA area id, or area
 * name - e.g. a Bermuda/ESPresense area sensor). The dot glides to that
 * room's centre and hides when the person isn't on this floor.
 *
 * A dynamic_map map-position sensor (#1354) also carries `floor`, `x`, `y`
 * (map %): the dot then sits on that spot, and only on that floor.
 */

// Same set, order and floor rule as position_math.room_for_area; both suites
// run tests/fixtures/area_room_cases.json (#1708).
const NOWHERE = ['', 'unknown', 'unavailable', 'not_home', 'away', 'none', 'off'];
const PALETTE = ['#f472b6', '#38bdf8', '#a3e635', '#fb923c'];

export function buildPresenceLayer(host) {
    host._presenceDots = null;
    const items = Array.isArray(host.config.presence) ? host.config.presence : [];
    if (!items.length) return;
    const svgNS = host.svgNS;
    const layer = document.createElementNS(svgNS, 'g');
    layer.classList.add('dm-presence-layer');
    layer.style.pointerEvents = 'none';
    const r = host.imgW * 0.024;
    host._presenceDots = items.filter(it => it && it.entity).map((it, idx) => {
        const el = document.createElementNS(svgNS, 'g');
        el.classList.add('dm-presence-dot');
        el.style.display = 'none';
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('r', r.toFixed(1));
        circle.setAttribute('fill', it.color || PALETTE[idx % PALETTE.length]);
        circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
        circle.setAttribute('stroke-width', (host.imgW * 0.004).toFixed(1));
        el.appendChild(circle);
        const initial = (it.name || it.entity.split('.')[1] || '?').trim().charAt(0).toUpperCase();
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'central');
        label.setAttribute('font-size', (r * 1.1).toFixed(1));
        label.setAttribute('font-weight', '700');
        label.setAttribute('fill', '#ffffff');
        label.textContent = initial;
        el.appendChild(label);
        layer.appendChild(el);
        return { el, label, entity: it.entity, visible: false, curX: 0, curY: 0, tx: 0, ty: 0 };
    });
    host.presenceLayer = layer;
    host.mapRoot.appendChild(layer);
    orientPresence(host, false);
    // Place the dots now: a floor switch rebuilds the layer, and the next hass push may be seconds away.
    if (host._hass) updatePresence(host, host._hass);
}

/**
 * Find the room an entity's state names on these rooms (one floor), or null:
 * HA area id first, then room name, then HA area name. A raw area sensor
 * carries no floor, so the card matches on the floor it shows; the backend
 * takes the first floor in number order with a match.
 */
export function roomForState(rooms, state, areas) {
    const s = state ? String(state).trim().toLowerCase() : '';
    if (NOWHERE.includes(s)) return null;
    return rooms.find(rm => rm.area_id && String(rm.area_id).toLowerCase() === s)
        || rooms.find(rm => (rm.name || '').trim().toLowerCase() === s)
        || rooms.find(rm => rm.area_id && ((areas || {})[rm.area_id]?.name || '').trim().toLowerCase() === s)
        || null;
}

/**
 * The room for a presence state. A dynamic_map position sensor has already
 * resolved floor + room_id in the backend: use that, so card and sensor
 * agree; anything else (a Bermuda area sensor) goes through roomForState.
 * Returns undefined when the resolved room is on another floor.
 */
export function roomForPresence(rooms, st, areas, activeFloor) {
    const a = st && st.attributes;
    if (a && a.room_id && a.floor !== undefined && a.floor !== null) {
        if (String(a.floor) !== String(activeFloor)) return undefined;
        return rooms.find(rm => rm.id === a.room_id) || null;
    }
    return roomForState(rooms, st ? st.state : '', areas);
}

export function updatePresence(host, hass) {
    if (!host._presenceDots || !hass || !hass.states) return;
    const byRoom = {};
    host._presenceDots.forEach(dot => {
        const st = hass.states[dot.entity];
        const spot = spotForState(st, host.activeFloor);
        if (spot) {
            if (spot.here) place(dot, (spot.x / 100) * host.imgW, (spot.y / 100) * host.imgH);
            else hide(dot);
            return;
        }
        const room = roomForPresence(host.rooms, st, hass.areas, host.activeFloor);
        if (!room) {
            hide(dot);
            return;
        }
        (byRoom[room.id] = byRoom[room.id] || []).push({ dot, room });
    });
    for (const id in byRoom) {
        const group = byRoom[id];
        // The room's label sits on its centre: the dots go just under it, on screen.
        const [dx, dy] = screenDown(host, host.imgW * (group.length > 1 ? 0.06 : 0.036));
        group.forEach(({ dot, room }, i) => {
            const c = MapGeometry.getPolygonCenter(room.polygon);
            const off = group.length > 1 ? host.imgW * 0.025 : 0;
            const angle = (i / group.length) * Math.PI * 2;
            place(dot, (c[0] / 100) * host.imgW + dx + Math.cos(angle) * off, (c[1] / 100) * host.imgH + dy + Math.sin(angle) * off);
        });
    }
}

/**
 * Image-space step that shows as `d` straight down on screen: the map root is
 * rotate(90) then the flips (Viewport.js), so undo both.
 */
export function screenDown(host, d) {
    const sx = host.mapScaleX || 1, sy = host.mapScaleY || 1;
    return host.isRotated ? [sx * d, 0] : [0, sy * d];
}

/**
 * Keep the initials upright under the viewport's rotation and flips, as the
 * room labels are (labelTransform), and re-place the dots under the labels.
 * Called when the viewport changes; `replace` false while building.
 */
export function orientPresence(host, replace = true) {
    if (!host._presenceDots) return;
    let t = '';
    if ((host.mapScaleX || 1) !== 1 || (host.mapScaleY || 1) !== 1) t += `scale(${host.mapScaleX || 1}, ${host.mapScaleY || 1}) `;
    if (host.isRotated) t += 'rotate(-90)';
    host._presenceDots.forEach(dot => {
        if (t) dot.label.setAttribute('transform', t.trim());
        else dot.label.removeAttribute('transform');
    });
    if (replace && host._hass) {
        host._presenceDots.forEach(dot => { dot.visible = false; });   // re-placed at once, no glide
        updatePresence(host, host._hass);
    }
}

/**
 * {here, x, y} when the state carries a calibrated map spot (floor + x/y in
 * %), else null. A room-centre guess (source 'room') goes the room way, so
 * two people in one uncalibrated room still sit side by side.
 */
export function spotForState(st, activeFloor) {
    const a = st && st.attributes;
    if (!a || a.floor === undefined || a.floor === null || a.source === 'room') return null;
    const x = Number(a.x), y = Number(a.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { here: String(a.floor) === String(activeFloor), x, y };
}

function hide(dot) {
    dot.visible = false;
    dot.el.style.display = 'none';
}

function place(dot, x, y) {
    dot.tx = x;
    dot.ty = y;
    if (!dot.visible) {
        // First appearance: place directly, no glide from (0,0).
        dot.curX = dot.tx;
        dot.curY = dot.ty;
        dot.el.setAttribute('transform', `translate(${dot.curX.toFixed(1)}, ${dot.curY.toFixed(1)})`);
    }
    dot.visible = true;
    dot.el.style.display = 'block';
}

/** Per-frame glide toward the target position. */
export function animatePresence(host, deltaTime) {
    if (!host._presenceDots || !Number.isFinite(deltaTime) || deltaTime <= 0) return;
    const k = 1 - Math.exp(-deltaTime * 3);
    host._presenceDots.forEach(dot => {
        if (!dot.visible) return;
        if (Math.abs(dot.tx - dot.curX) < 0.05 && Math.abs(dot.ty - dot.curY) < 0.05) return;   // settled: nothing to write
        dot.curX += (dot.tx - dot.curX) * k;
        dot.curY += (dot.ty - dot.curY) * k;
        dot.el.setAttribute('transform', `translate(${dot.curX.toFixed(1)}, ${dot.curY.toFixed(1)})`);
    });
}

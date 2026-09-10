import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.1';

/**
 * Presence dots: card config `presence: [{entity, name?, color?}]` where
 * each entity's state names the room (room name, HA area id, or area
 * name - e.g. a Bermuda/ESPresense area sensor). The dot glides to that
 * room's centre and hides when the person isn't on this floor.
 */

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
    const r = host.imgW * 0.016;
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
        return { el, entity: it.entity, visible: false, curX: 0, curY: 0, tx: 0, ty: 0 };
    });
    host.presenceLayer = layer;
    host.mapRoot.appendChild(layer);
}

/** Find the room an entity's state names, or null. */
export function roomForState(rooms, state, areas) {
    const s = state ? String(state).trim().toLowerCase() : '';
    if (NOWHERE.includes(s)) return null;
    return rooms.find(rm => (rm.name || '').trim().toLowerCase() === s)
        || rooms.find(rm => rm.area_id && String(rm.area_id).toLowerCase() === s)
        || rooms.find(rm => rm.area_id && ((areas || {})[rm.area_id]?.name || '').trim().toLowerCase() === s)
        || null;
}

export function updatePresence(host, hass) {
    if (!host._presenceDots || !hass || !hass.states) return;
    const byRoom = {};
    host._presenceDots.forEach(dot => {
        const st = hass.states[dot.entity];
        const room = roomForState(host.rooms, st ? st.state : '', hass.areas);
        if (!room) {
            dot.visible = false;
            dot.el.style.display = 'none';
            return;
        }
        (byRoom[room.id] = byRoom[room.id] || []).push({ dot, room });
    });
    for (const id in byRoom) {
        const group = byRoom[id];
        group.forEach(({ dot, room }, i) => {
            const c = MapGeometry.getPolygonCenter(room.polygon);
            const off = group.length > 1 ? host.imgW * 0.025 : 0;
            const angle = (i / group.length) * Math.PI * 2;
            dot.tx = (c[0] / 100) * host.imgW + Math.cos(angle) * off;
            dot.ty = (c[1] / 100) * host.imgH + Math.sin(angle) * off;
            if (!dot.visible) {
                // First appearance: place directly, no glide from (0,0).
                dot.curX = dot.tx;
                dot.curY = dot.ty;
                dot.el.setAttribute('transform', `translate(${dot.curX.toFixed(1)}, ${dot.curY.toFixed(1)})`);
            }
            dot.visible = true;
            dot.el.style.display = 'block';
        });
    }
}

/** Per-frame glide toward the target position. */
export function animatePresence(host, deltaTime) {
    if (!host._presenceDots || !Number.isFinite(deltaTime) || deltaTime <= 0) return;
    const k = 1 - Math.exp(-deltaTime * 3);
    host._presenceDots.forEach(dot => {
        if (!dot.visible) return;
        dot.curX += (dot.tx - dot.curX) * k;
        dot.curY += (dot.ty - dot.curY) * k;
        dot.el.setAttribute('transform', `translate(${dot.curX.toFixed(1)}, ${dot.curY.toFixed(1)})`);
    });
}

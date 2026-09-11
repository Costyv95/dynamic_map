import { areaEntities } from './RoomEntities.js?v=3.2.1';
import { roomBox } from '../core/RoomLabels.js?v=3.2.1';

/**
 * Attention badges on rooms: a red counter in the room's corner when a
 * door/window is open, a leak or smoke is detected, or a device of the
 * area is unavailable. Tapping it focuses the room. Off with
 * `room_alerts: false`.
 */
const OPEN_CLASSES = ['door', 'window', 'opening', 'garage_door'];
const DANGER_CLASSES = ['moisture', 'smoke', 'gas', 'carbon_monoxide', 'safety', 'problem'];

/** Alerts for one room: [{ id, kind: 'open'|'danger'|'unavailable', name }]. */
export function roomAlerts(hass, room) {
    if (!hass || !hass.states || !room.area_id) return [];
    const out = [];
    areaEntities(hass, room.area_id).forEach(id => {
        const st = hass.states[id];
        const a = st.attributes || {};
        const name = a.friendly_name || id;
        if (st.state === 'unavailable') { out.push({ id, kind: 'unavailable', name }); return; }
        if (id.startsWith('binary_sensor.') && st.state === 'on') {
            if (OPEN_CLASSES.includes(a.device_class)) out.push({ id, kind: 'open', name });
            else if (DANGER_CLASSES.includes(a.device_class)) out.push({ id, kind: 'danger', name });
        }
    });
    return out;
}

export function alertsSignature(host, hass) {
    if (host.config && host.config.room_alerts === false) return '';
    return (host.rooms || []).map(r => roomAlerts(hass, r).map(a => a.kind[0] + a.id).join(',')).join('|');
}

/** Build (once) the layer that holds one badge group per room. */
export function buildRoomAlerts(host) {
    host.alertsLayer = null;
    if (host.config && host.config.room_alerts === false) return;
    const layer = document.createElementNS(host.svgNS, 'g');
    layer.classList.add('dm-room-alerts');
    host.mapRoot.appendChild(layer);
    host.alertsLayer = layer;
    host._alertEls = {};
}

/** Re-render badges when the alert signature changed. */
export function updateRoomAlerts(host, hass) {
    if (!host.alertsLayer || !hass) return;
    const sig = alertsSignature(host, hass);
    if (sig === host._alertsSig) return;
    host._alertsSig = sig;
    const svgNS = host.svgNS;
    const r = host.imgW * 0.014;
    host.rooms.forEach(room => {
        const alerts = roomAlerts(hass, room);
        let g = host._alertEls[room.id];
        if (!alerts.length) { if (g) g.style.display = 'none'; return; }
        if (!g) {
            g = document.createElementNS(svgNS, 'g');
            g.classList.add('dm-room-alert');
            g.style.cursor = 'pointer';
            const c = document.createElementNS(svgNS, 'circle');
            c.setAttribute('r', r.toFixed(1));
            c.setAttribute('stroke', 'rgba(255,255,255,0.9)');
            c.setAttribute('stroke-width', (r * 0.18).toFixed(1));
            const t = document.createElementNS(svgNS, 'text');
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('dominant-baseline', 'central');
            t.setAttribute('font-size', (r * 1.25).toFixed(1));
            t.setAttribute('font-weight', '700');
            t.setAttribute('fill', '#fff');
            t.style.pointerEvents = 'none';
            g.append(c, t);
            g.addEventListener('click', (e) => { e.stopPropagation(); if (host.onRoomTap) host.onRoomTap(room); });
            host.alertsLayer.appendChild(g);
            host._alertEls[room.id] = g;
        }
        const box = roomBox(room, host.imgW, host.imgH);
        const x = box.cx + box.w / 2 - r * 1.6, y = box.cy - box.h / 2 + r * 1.6;
        const danger = alerts.some(a => a.kind === 'danger');
        const only = alerts.every(a => a.kind === 'unavailable');
        g.querySelector('circle').setAttribute('fill', danger ? '#ef4444' : (only ? '#94a3b8' : '#f59e0b'));
        g.querySelector('text').textContent = alerts.length > 9 ? '9+' : String(alerts.length);
        g.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)})${host.isRotated ? ' rotate(-90)' : ''}`);
        g.style.display = 'block';
        const title = alerts.map(a => `${a.kind === 'open' ? 'Open' : a.kind === 'danger' ? 'Alert' : 'Unavailable'}: ${a.name}`).join('\\n');
        let tt = g.querySelector('title');
        if (!tt) { tt = document.createElementNS(svgNS, 'title'); g.appendChild(tt); }
        tt.textContent = title;
    });
}

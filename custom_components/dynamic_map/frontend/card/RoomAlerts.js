import { areaEntities } from './RoomEntities.js?v=3.2.1';
import { roomBox } from '../core/RoomLabels.js?v=3.2.1';
import { buildAlertLegend, updateAlertLegend } from './AlertLegend.js?v=3.2.1';
import { roomVacuumAlerts } from './VacuumAlerts.js?v=3.2.1';

/**
 * Attention badges on rooms: a counter in the room's corner while a
 * door/window is open (amber) or a leak/smoke/gas sensor fires (red).
 * Unavailable devices are counted only when asked for (grey). Tapping a
 * badge focuses the room; hovering lists the reasons.
 *
 * Robot vacuum to-dos (water, consumables, errors) show in the room that
 * hosts the vacuum badge (indigo). Config: `room_alerts: false` (off),
 * `true` (open + danger + vacuum, the default), a list like
 * `[open, danger, vacuum, unavailable]`, or `{unavailable: true}`.
 */
const OPEN_CLASSES = ['door', 'window', 'opening', 'garage_door'];
const DANGER_CLASSES = ['moisture', 'smoke', 'gas', 'carbon_monoxide', 'safety', 'problem'];
const ALL_KINDS = ['open', 'danger', 'vacuum', 'unavailable'];
const KIND_LABEL = { open: 'Open', danger: 'Alert', vacuum: 'Robot', unavailable: 'Unavailable' };
const KIND_FILL = { danger: '#ef4444', open: '#f59e0b', vacuum: '#6366f1', unavailable: '#94a3b8' };

/** The alert kinds the card shows, or null when the feature is off. */
export function alertKinds(config) {
    const v = config ? config.room_alerts : undefined;
    if (v === false) return null;
    if (Array.isArray(v)) return ALL_KINDS.filter(k => v.includes(k));
    if (v && typeof v === 'object') return ALL_KINDS.filter(k => k === 'unavailable' ? v.unavailable === true : v[k] !== false);
    return ['open', 'danger', 'vacuum'];
}

/** Alerts for one room: [{ id, kind: 'open'|'danger'|'vacuum'|'unavailable', name, icon?, action? }]. `host` adds the vacuum to-dos. */
export function roomAlerts(hass, room, kinds = ALL_KINDS, host = null) {
    if (!hass || !hass.states) return [];
    const out = host ? roomVacuumAlerts(host, hass, room, kinds) : [];
    if (!room.area_id) return out;
    areaEntities(hass, room.area_id).forEach(id => {
        if (out.some(a => a.id === id)) return;
        const st = hass.states[id];
        const a = st.attributes || {};
        const name = a.friendly_name || id;
        if (st.state === 'unavailable') { if (kinds.includes('unavailable')) out.push({ id, kind: 'unavailable', name }); return; }
        if (id.startsWith('binary_sensor.') && st.state === 'on') {
            if (OPEN_CLASSES.includes(a.device_class) && kinds.includes('open')) out.push({ id, kind: 'open', name });
            else if (DANGER_CLASSES.includes(a.device_class) && kinds.includes('danger')) out.push({ id, kind: 'danger', name });
        }
    });
    return out;
}

export function alertsSignature(host, hass) {
    const kinds = alertKinds(host.config);
    if (!kinds) return '';
    const view = `${host.isRotated ? 'r' : ''}${host.mapScaleX || 1},${host.mapScaleY || 1}@${badgeRadius(host).toFixed(0)}`;
    return view + '#' + (host.rooms || []).map(r => roomAlerts(hass, r, kinds, host).map(a => a.kind[0] + a.id).join(',')).join('|');
}

/** Build (once) the layer that holds one badge group per room. */
export function buildRoomAlerts(host) {
    host.alertsLayer = null;
    if (!alertKinds(host.config)) return;
    const layer = document.createElementNS(host.svgNS, 'g');
    layer.classList.add('dm-room-alerts');
    host.mapRoot.appendChild(layer);
    host.alertsLayer = layer;
    host._alertEls = {};
    buildAlertLegend(host);
}

/** Counter-transform so the badge reads upright under the map's rotation/flip. */
function uprightTransform(host) {
    const sx = host.mapScaleX || 1, sy = host.mapScaleY || 1;
    let s = '';
    if (sx !== 1 || sy !== 1) s += ` scale(${sx}, ${sy})`;
    if (host.isRotated) s += ' rotate(-90)';
    return s;
}

const MIN_RADIUS_PX = 11;   // a badge is a tap target: never smaller than this on screen

/** Badge radius in map units: 1.4% of the image, but at least MIN_RADIUS_PX on screen at the default zoom. */
export function badgeRadius(host) {
    let r = host.imgW * 0.014;
    const vbW = host.defaultVb ? host.defaultVb.w : 0;
    const pxW = host.svg && host.svg.getBoundingClientRect ? host.svg.getBoundingClientRect().width : 0;
    if (vbW > 0 && pxW > 0) r = Math.max(r, MIN_RADIUS_PX * vbW / pxW);
    return r;
}

function sizeBadge(g, r) {
    const c = g.querySelector('circle'), t = g.querySelector('text');
    c.setAttribute('r', r.toFixed(1));
    c.setAttribute('stroke-width', (r * 0.18).toFixed(1));
    t.setAttribute('font-size', (r * 1.25).toFixed(1));
}

function makeBadge(host, room) {
    const svgNS = host.svgNS;
    const g = document.createElementNS(svgNS, 'g');
    g.classList.add('dm-room-alert');
    g.style.cursor = 'pointer';
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('stroke', 'rgba(255,255,255,0.9)');
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('font-weight', '700');
    t.setAttribute('fill', '#fff');
    t.style.pointerEvents = 'none';
    g.append(c, t, document.createElementNS(svgNS, 'title'));
    g.addEventListener('click', (e) => { e.stopPropagation(); if (host.onAlertTap) host.onAlertTap(room); else if (host.onRoomTap) host.onRoomTap(room); });
    host.alertsLayer.appendChild(g);
    return g;
}

/** Re-render badges when the alert signature (or the map orientation) changed. */
export function updateRoomAlerts(host, hass) {
    if (!host.alertsLayer || !hass) return;
    const sig = alertsSignature(host, hass);
    if (sig === host._alertsSig) return;
    host._alertsSig = sig;
    const kinds = alertKinds(host.config);
    const r = badgeRadius(host);
    const upright = uprightTransform(host);
    const counts = { open: 0, danger: 0, vacuum: 0, unavailable: 0 };
    let firstRoom = null;
    host.rooms.forEach(room => {
        const alerts = roomAlerts(hass, room, kinds, host);
        let g = host._alertEls[room.id];
        if (!alerts.length) { if (g) g.style.display = 'none'; return; }
        alerts.forEach(a => { counts[a.kind]++; });
        firstRoom = firstRoom || room;
        if (!g) g = host._alertEls[room.id] = makeBadge(host, room);
        sizeBadge(g, r);
        const box = roomBox(room, host.imgW, host.imgH);
        const x = box.cx + box.w / 2 - r * 1.6, y = box.cy - box.h / 2 + r * 1.6;
        const worst = ['danger', 'open', 'vacuum', 'unavailable'].find(k => alerts.some(a => a.kind === k)) || 'unavailable';
        g.querySelector('circle').setAttribute('fill', KIND_FILL[worst]);
        g.querySelector('text').textContent = alerts.length > 9 ? '9+' : String(alerts.length);
        g.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)})${upright}`);
        g.style.display = 'block';
        g.querySelector('title').textContent = alerts.map(a => `${KIND_LABEL[a.kind]}: ${a.name}`).join('\n');
    });
    updateAlertLegend(host, counts, firstRoom);
}

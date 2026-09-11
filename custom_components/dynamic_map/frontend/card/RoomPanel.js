import { areaEntities, describeEntity, controlCall } from './RoomEntities.js?v=3.2.1';
import { roomAlerts, alertKinds } from './RoomAlerts.js?v=3.2.1';
import { scenesBar } from './RoomScenes.js?v=3.2.1';
import { attachTrend } from './RoomHistory.js?v=3.2.1';
import { roomTemperatureEntity } from './RoomTemperature.js?v=3.2.1';

/**
 * Glass panel that opens with a room's zoom: everything in the room's HA
 * area, live, with one-tap controls. Disable per card with
 * `room_panel: false`; rows are capped by `room_panel_max` (default 12).
 * `host` is the card.
 */

export function buildRoomPanelEl(host) {
    host.roomPanel = document.createElement('div');
    host.roomPanel.className = 'dm-room-panel';
    host.roomPanel.addEventListener('pointerdown', e => e.stopPropagation());
    host.roomPanel.addEventListener('click', e => e.stopPropagation());
    host.renderRoot.appendChild(host.roomPanel);
    host._roomPanelRoom = null;
}

/** Open the panel for a room. `force` shows it even with `room_panel: false` (alert badge tap). */
export function showRoomPanel(host, room, force = false) {
    if (!host.roomPanel || (host.config.room_panel === false && !force)) return;
    host._roomPanelRoom = room;
    updateRoomPanel(host, host._hass);
}

export function hideRoomPanel(host) {
    if (!host.roomPanel) return;
    host._roomPanelRoom = null;
    host.roomPanel.classList.remove('dm-visible', 'dm-expanded');
    host.renderRoot.classList.remove('dm-room-panel-open');
}

/** Re-render rows from the current hass (cheap: a dozen small nodes). */
export function updateRoomPanel(host, hass) {
    const panel = host.roomPanel;
    const room = host._roomPanelRoom;
    if (!panel || !room || !hass || host._rpDragging) return;   // never re-render under a finger on a slider
    const ids = room.area_id ? areaEntities(hass, room.area_id) : [];
    if (room.entity_id && hass.states[room.entity_id] && !ids.includes(room.entity_id)) ids.unshift(room.entity_id);
    const max = Number(host.config.room_panel_max) > 0 ? Number(host.config.room_panel_max) : 12;
    const dead = (id) => { const s = hass.states[id] && hass.states[id].state; return s === 'unavailable' || s === 'unknown'; };
    const shown = [...ids.filter(id => !dead(id)), ...ids.filter(dead)].slice(0, max);   // live controls first
    const kinds = alertKinds(host.config);
    const alerts = kinds ? roomAlerts(hass, room, kinds, host) : [];
    const onIds = shown.filter(id => describeEntity(hass, id).kind === 'toggle' && hass.states[id].state === 'on');
    const tempId = roomTemperatureEntity(host, hass, room);
    const trend = document.createElement('div');
    trend.className = 'dm-rp-trend';
    trend.hidden = true;
    panel.replaceChildren(
        handle(host),
        header(host, room, ids.length, onIds),
        trend,
        ...(alerts.length ? [attention(host, alerts)] : []),
        ...[scenesBar(host, hass, room)].filter(Boolean),
        shown.length ? rows(host, hass, shown) : empty(room)
    );
    if (tempId) attachTrend(host, trend, tempId);
    panel.classList.add('dm-visible');
    host.renderRoot.classList.add('dm-room-panel-open');
}

/** Phone bottom sheet grip: tap or swipe up expands, swipe down collapses, then closes. */
function handle(host) {
    const h = document.createElement('div');
    h.className = 'dm-rp-handle';
    h.title = 'Expand or collapse';
    const panel = host.roomPanel;
    const setExpanded = (on) => panel.classList.toggle('dm-expanded', on);
    let startY = null;
    h.addEventListener('pointerdown', (e) => { startY = e.clientY; e.stopPropagation(); });
    h.addEventListener('pointerup', (e) => {
        const dy = startY === null ? 0 : e.clientY - startY;
        startY = null;
        if (dy < -20) setExpanded(true);
        else if (dy > 20) { if (panel.classList.contains('dm-expanded')) setExpanded(false); else host.zoomOutToDefault(); }
        else setExpanded(!panel.classList.contains('dm-expanded'));
    });
    return h;
}

function header(host, room, count, onIds = []) {
    const h = document.createElement('div');
    h.className = 'dm-rp-head';
    h.innerHTML = `<span class="dm-rp-title"></span><span class="dm-rp-count"></span><button class="dm-rp-alloff" title="Switch off everything that is on in this room">All off</button><button class="dm-rp-close" title="Close">✕</button>`;
    h.querySelector('.dm-rp-title').textContent = room.name || 'Room';
    h.querySelector('.dm-rp-count').textContent = count ? `${count}` : '';
    const off = h.querySelector('.dm-rp-alloff');
    off.hidden = onIds.length === 0;
    off.addEventListener('click', () => { if (host._hass) host._hass.callService('homeassistant', 'turn_off', { entity_id: onIds }); });
    h.querySelector('.dm-rp-close').addEventListener('click', () => host.zoomOutToDefault());
    return h;
}

const ALERT_ICON = { open: '🚪', danger: '⚠️', vacuum: '🤖', unavailable: '⛔' };
const ALERT_TEXT = { open: 'Open', danger: 'Alert', vacuum: 'To do', unavailable: 'Unavailable' };

/** "Needs attention" rows: one per alert, tap for the entity's more-info dialog. */
function attention(host, alerts) {
    const box = document.createElement('div');
    box.className = 'dm-rp-attention';
    const h = document.createElement('div');
    h.className = 'dm-rp-subhead';
    h.textContent = `Needs attention · ${alerts.length}`;
    box.appendChild(h);
    alerts.forEach(a => {
        const r = document.createElement('div');
        r.className = `dm-rp-row dm-rp-alert dm-rp-alert-${a.kind}`;
        r.innerHTML = `<span class="dm-rp-icon"></span><span class="dm-rp-name"></span><span class="dm-rp-value"></span>`;
        r.querySelector('.dm-rp-icon').textContent = a.icon || ALERT_ICON[a.kind] || '!';
        r.querySelector('.dm-rp-name').textContent = a.name;
        r.querySelector('.dm-rp-value').textContent = ALERT_TEXT[a.kind] || a.kind;
        r.title = `${a.robot ? a.robot + ' — ' : ''}${a.name}: open details`;
        r.addEventListener('click', () => host.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: a.id }, bubbles: true, composed: true })));
        if (a.action) {
            const btn = document.createElement('button');
            btn.className = 'dm-rp-btn';
            btn.textContent = a.action.label || 'Done';
            btn.title = 'Mark as done (resets the counter on the robot)';
            btn.addEventListener('click', (e) => { e.stopPropagation(); if (host._hass) host._hass.callService(a.action.domain, a.action.service, a.action.data); });
            r.appendChild(btn);
        }
        box.appendChild(r);
    });
    return box;
}

function empty(room) {
    const d = document.createElement('div');
    d.className = 'dm-rp-empty';
    d.textContent = room.area_id ? 'Nothing in this area yet.' : 'Link this room to a Home Assistant area in the editor to see its devices here.';
    return d;
}

function rows(host, hass, ids) {
    const list = document.createElement('div');
    list.className = 'dm-rp-list';
    ids.forEach(id => list.appendChild(row(host, describeEntity(hass, id))));
    return list;
}

/** Brightness slider under a dimmable light; the row's toggle stays on the switch. */
function slider(host, d, r, call) {
    r.classList.add('dm-rp-dim');
    const s = document.createElement('input');
    s.type = 'range'; s.min = '1'; s.max = '100'; s.value = String(d.brightness || 50);
    s.className = 'dm-rp-slider';
    s.title = 'Brightness';
    s.addEventListener('click', (e) => e.stopPropagation());
    s.addEventListener('pointerdown', (e) => { e.stopPropagation(); host._rpDragging = true; });
    s.addEventListener('input', () => { r.querySelector('.dm-rp-value').textContent = `${s.value}%`; });
    const commit = () => { host._rpDragging = false; call(controlCall(d, 'brightness', Number(s.value))); r.classList.add('dm-on'); };
    s.addEventListener('change', commit);
    s.addEventListener('pointercancel', () => { host._rpDragging = false; });
    return s;
}

function row(host, d) {
    const r = document.createElement('div');
    r.className = `dm-rp-row dm-rp-${d.kind}${d.on ? ' dm-on' : ''}`;
    r.innerHTML = `<span class="dm-rp-icon"></span><span class="dm-rp-name"></span><span class="dm-rp-value"></span>`;
    r.querySelector('.dm-rp-icon').textContent = d.icon;
    r.querySelector('.dm-rp-name').textContent = d.name;
    r.querySelector('.dm-rp-value').textContent = d.value;
    r.title = d.name;
    const call = (c) => { if (c && host._hass) host._hass.callService(c.domain, c.service, c.data); };
    if (d.dimmable && !d.unavailable) r.appendChild(slider(host, d, r, call));
    if (d.unavailable) {
        // No controls for a dead device: the row only opens more-info (where HA explains why).
        r.classList.add('dm-rp-unavailable');
        r.addEventListener('click', () => host.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: d.id }, bubbles: true, composed: true })));
    } else if (d.kind === 'toggle') {
        const sw = document.createElement('span');
        sw.className = 'dm-rp-switch';
        sw.innerHTML = '<span class="dm-rp-thumb"></span>';
        r.appendChild(sw);
        r.addEventListener('click', () => { r.classList.toggle('dm-on'); call(controlCall(d)); });
    } else if (d.kind === 'climate') {
        const ctl = document.createElement('span');
        ctl.className = 'dm-rp-stepper';
        ctl.innerHTML = '<button title="Lower">−</button><button title="Raise">+</button>';
        const [down, up] = ctl.querySelectorAll('button');
        down.addEventListener('click', (e) => { e.stopPropagation(); call(controlCall(d, 'down')); });
        up.addEventListener('click', (e) => { e.stopPropagation(); call(controlCall(d, 'up')); });
        r.appendChild(ctl);
        if (d.current !== undefined && d.current !== null) r.querySelector('.dm-rp-value').textContent = `${d.current}° → ${d.value}`;
    } else if (['cover', 'lock', 'media', 'vacuum'].includes(d.kind)) {
        const btn = document.createElement('button');
        btn.className = 'dm-rp-btn';
        btn.textContent = { cover: d.on ? 'Close' : 'Open', lock: d.on ? 'Lock' : 'Unlock', media: d.on ? '⏸' : '▶', vacuum: d.on ? 'Dock' : 'Clean' }[d.kind];
        btn.addEventListener('click', (e) => { e.stopPropagation(); call(controlCall(d)); });
        r.appendChild(btn);
    } else {
        r.addEventListener('click', () => host.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: d.id }, bubbles: true, composed: true })));
    }
    return r;
}

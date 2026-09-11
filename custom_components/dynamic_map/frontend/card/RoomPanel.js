import { areaEntities, describeEntity, controlCall } from './RoomEntities.js?v=3.2.1';

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

export function showRoomPanel(host, room) {
    if (!host.roomPanel || host.config.room_panel === false) return;
    host._roomPanelRoom = room;
    updateRoomPanel(host, host._hass);
}

export function hideRoomPanel(host) {
    if (!host.roomPanel) return;
    host._roomPanelRoom = null;
    host.roomPanel.classList.remove('dm-visible');
}

/** Re-render rows from the current hass (cheap: a dozen small nodes). */
export function updateRoomPanel(host, hass) {
    const panel = host.roomPanel;
    const room = host._roomPanelRoom;
    if (!panel || !room || !hass) return;
    const ids = room.area_id ? areaEntities(hass, room.area_id) : [];
    if (room.entity_id && hass.states[room.entity_id] && !ids.includes(room.entity_id)) ids.unshift(room.entity_id);
    const max = Number(host.config.room_panel_max) > 0 ? Number(host.config.room_panel_max) : 12;
    const shown = ids.slice(0, max);
    panel.replaceChildren(
        header(host, room, ids.length),
        shown.length ? rows(host, hass, shown) : empty(room)
    );
    panel.classList.add('dm-visible');
}

function header(host, room, count) {
    const h = document.createElement('div');
    h.className = 'dm-rp-head';
    h.innerHTML = `<span class="dm-rp-title"></span><span class="dm-rp-count"></span><button class="dm-rp-close" title="Close">✕</button>`;
    h.querySelector('.dm-rp-title').textContent = room.name || 'Room';
    h.querySelector('.dm-rp-count').textContent = count ? `${count}` : '';
    h.querySelector('.dm-rp-close').addEventListener('click', () => host.zoomOutToDefault());
    return h;
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

function row(host, d) {
    const r = document.createElement('div');
    r.className = `dm-rp-row dm-rp-${d.kind}${d.on ? ' dm-on' : ''}`;
    r.innerHTML = `<span class="dm-rp-icon"></span><span class="dm-rp-name"></span><span class="dm-rp-value"></span>`;
    r.querySelector('.dm-rp-icon').textContent = d.icon;
    r.querySelector('.dm-rp-name').textContent = d.name;
    r.querySelector('.dm-rp-value').textContent = d.value;
    r.title = d.name;
    const call = (c) => { if (c && host._hass) host._hass.callService(c.domain, c.service, c.data); };
    if (d.kind === 'toggle') {
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

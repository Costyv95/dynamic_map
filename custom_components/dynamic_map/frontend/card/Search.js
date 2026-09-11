import { indexFloor, matchIndex } from './SearchIndex.js?v=3.2.1';
import { shortcutFrame } from '../shared/ShortcutGeometry.js?v=3.2.1';
import { showRoomPanel } from './RoomPanel.js?v=3.2.1';

/**
 * Find a device or room across floors: 🔍 next to the floor chips opens a
 * glass search box; picking a result switches floor if needed, zooms to
 * the badge (pulsing it) or the room, and opens the room panel.
 */
export function buildSearch(host) {
    if (!host.topLeftUI) return;
    const btn = document.createElement('button');
    btn.className = 'dm-icon-btn dm-search-btn';
    btn.title = 'Find a device or room';
    btn.textContent = '🔍';
    btn.addEventListener('click', (e) => { e.stopPropagation(); openSearch(host); });
    host.topLeftUI.appendChild(btn);
}

async function floorData(host, floor) {
    host._searchCache = host._searchCache || {};
    if (floor == host.activeFloor) return { rooms: host.rooms || [], shortcuts: host.shortcuts || [] };
    if (!host._searchCache[floor]) {
        const get = (u) => fetch(u).then(r => (r.ok ? r.json() : [])).catch(() => []);
        host._searchCache[floor] = Promise.all([get(`/dynamic_map_data/rooms_floor${floor}.json`), get(`/dynamic_map_data/shortcuts_floor${floor}.json`)]).then(([rooms, shortcuts]) => ({ rooms: rooms || [], shortcuts: shortcuts || [] }));
    }
    return host._searchCache[floor];
}

/** All entries across the configured floors (the active floor from memory, others from the data files). */
export async function searchEntries(host) {
    const floors = (host.config && host.config.floors && host.config.floors.length) ? host.config.floors : [host.activeFloor];
    const label = (f) => (host.floorLabel ? host.floorLabel(f) : `Floor ${f}`);
    const parts = await Promise.all(floors.map(async f => indexFloor(f, await floorData(host, f), host._hass, label)));
    return parts.flat();
}

export function openSearch(host) {
    if (host._searchEl) { host._searchEl.querySelector('input').focus(); return; }
    const box = document.createElement('div');
    box.className = 'dm-search';
    box.innerHTML = '<input type="search" placeholder="Find a device or room…" autocomplete="off"><div class="dm-search-results"></div>';
    box.addEventListener('pointerdown', e => e.stopPropagation());
    box.addEventListener('click', e => e.stopPropagation());
    host.renderRoot.appendChild(box);
    host._searchEl = box;
    const input = box.querySelector('input');
    const results = box.querySelector('.dm-search-results');
    const close = () => { box.remove(); host._searchEl = null; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    let entries = null;
    const render = async () => {
        entries = entries || await searchEntries(host);
        const hits = matchIndex(entries, input.value);
        results.replaceChildren(...hits.map(e => resultRow(host, e, close)));
        results.hidden = !input.value.trim();
        if (input.value.trim() && !hits.length) results.replaceChildren(Object.assign(document.createElement('div'), { className: 'dm-search-empty', textContent: 'Nothing matches.' }));
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = results.querySelector('.dm-search-row'); if (first) first.click(); } });
    setTimeout(() => input.focus(), 0);
    render();
    return box;
}

function resultRow(host, e, close) {
    const row = document.createElement('div');
    row.className = `dm-search-row dm-search-${e.kind}`;
    row.innerHTML = '<span class="dm-search-icon"></span><span class="dm-search-name"></span><span class="dm-search-sub"></span>';
    row.querySelector('.dm-search-icon').textContent = e.icon;
    row.querySelector('.dm-search-name').textContent = e.name;
    row.querySelector('.dm-search-sub').textContent = e.sub;
    row.addEventListener('click', () => { close(); goTo(host, e); });
    return row;
}

/** Switch floor when needed, then zoom to the entry. */
export async function goTo(host, e) {
    if (e.floor != host.activeFloor) {
        const built = host.whenBuilt();
        host.activeFloor = e.floor;
        host.loadData();
        await built;
    }
    if (e.kind === 'badge') return focusBadge(host, e.id);
    const room = (host.rooms || []).find(r => r.id === (e.kind === 'room' ? e.id : e.roomId));
    if (!room) return false;
    host.focusedRoomId = room.id;
    host.updateRoomStyles();
    host.zoomToRoom(room);
    showRoomPanel(host, room, true);
    return true;
}

/** Zoom to a badge and pulse a ring around it. */
export function focusBadge(host, id) {
    const sc = (host.shortcuts || []).find(s => s.id === id);
    if (!sc) return false;
    const f = shortcutFrame(sc, { mode: host.activeMode, imgW: host.imgW, imgH: host.imgH, hass: host._hass });
    const c = host.mapPointToView(f.x, f.y);
    const rect = host.getBoundingClientRect ? host.getBoundingClientRect() : { width: 1, height: 1 };
    const ratio = (rect.width > 0 ? rect.width : 1) / (rect.height > 0 ? rect.height : 1);
    const w = Math.max(host.imgW * 0.22, f.w * 4), h = w / ratio;
    host.focusedRoomId = null;
    host._zoomTargetVb = { x: c.x - w / 2, y: c.y - h / 2, w, h };
    host.animateViewBox(host._zoomTargetVb);
    const el = host.shortcutElements && host.shortcutElements[id];
    if (el && el.group) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('class', 'dm-pulse');
        ring.setAttribute('r', String(Math.max(f.w, f.h) * 0.8));
        el.group.appendChild(ring);
        setTimeout(() => ring.remove(), 2600);
    }
    return true;
}

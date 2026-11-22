import { choresState, roomChores, choreState } from './Chores.js?v=3.2.1';
import { choreRow } from './ChoresPanel.js?v=3.2.1';
import { chorePeople, selectedPerson } from './ChoreWho.js?v=3.2.1';

/**
 * Late chores, house-wide: the legend's red "N late" chip lists every chore
 * past its due date (Crumbs `state: late`) from every area, floor-wide ones
 * included, in the room panel (docked on wide cards, a sheet on phones),
 * grouped by room, each with its Done button. A room heading that is on
 * the shown floor opens that room. A room tap, ✕ or Lights mode closes it.
 */

/** [{key, entry, chores}] with late chores, most late first. */
export function lateChoreAreas(host, hass, now = new Date()) {
    const st = choresState(host, hass);
    const areas = st && st.attributes && st.attributes.areas;
    if (!areas || typeof areas !== 'object') return [];
    const most = (list) => Math.max(0, ...list.map(c => Number(c.late_days) || 0));
    return Object.entries(areas)
        .map(([key, entry]) => ({ key, entry, chores: (entry && Array.isArray(entry.chores) ? entry.chores : []).filter(c => choreState(c, now) === 'late') }))
        .filter(a => a.chores.length)
        .map(a => ({ ...a, chores: a.chores.slice().sort((x, y) => (Number(y.late_days) || 0) - (Number(x.late_days) || 0)) }))
        .sort((a, b) => most(b.chores) - most(a.chores));
}

export function lateCount(host, hass) {
    return lateChoreAreas(host, hass).reduce((n, a) => n + a.chores.length, 0);
}

const refresh = (host) => { if (host.refreshRoomPanel) host.refreshRoomPanel(); };

export function openLateChores(host) {
    host._lateChoresOpen = true;
    host._floorChoresOpen = false;
    refresh(host);
}

export function closeLateChores(host) {
    host._lateChoresOpen = false;
    refresh(host);
}

/** The map room showing `entry`, on the shown floor, or null. */
function roomFor(host, hass, entry) {
    return (host.rooms || []).find(r => roomChores(host, hass, r) === entry) || null;
}

/**
 * Show or hide the late list in the room panel while no room is open.
 * Returns true when it is shown (the floor-wide list then stays closed).
 */
export function updateLateChores(host, hass, dock = () => {}) {
    const panel = host.roomPanel;
    if (!panel || host._roomPanelRoom) return false;
    if (host.mapMode !== 'chores') host._lateChoresOpen = false;
    const list = host._lateChoresOpen ? lateChoreAreas(host, hass) : [];
    if (!list.length) {
        if (host._lateChoresShown) {
            panel.classList.remove('dm-visible', 'dm-expanded');
            host.renderRoot.classList.remove('dm-room-panel-open', 'dm-chores-dock');
        }
        host._lateChoresShown = false;
        host._lateChoresOpen = false;
        return false;
    }
    const n = list.reduce((s, a) => s + a.chores.length, 0);
    const head = document.createElement('div');
    head.className = 'dm-rp-head';
    head.innerHTML = '<span class="dm-rp-title"></span><span class="dm-rp-count"></span><button class="dm-rp-close" title="Close">✕</button>';
    head.querySelector('.dm-rp-title').textContent = '⚠️ Late chores';
    head.querySelector('.dm-rp-count').textContent = `${n} late`;
    head.querySelector('.dm-rp-close').addEventListener('click', (e) => { e.stopPropagation(); closeLateChores(host); });
    const person = selectedPerson(host, chorePeople(host, hass));
    const nodes = [head];
    list.forEach(({ key, entry, chores }) => {
        const sub = document.createElement('div');
        sub.className = 'dm-rp-subhead';
        sub.textContent = `${entry.emoji ? entry.emoji + ' ' : ''}${entry.room || key}`;
        const room = roomFor(host, hass, entry);
        if (room && host.onRoomTap) {
            sub.classList.add('dm-rp-link');
            sub.title = `Open ${room.name || entry.room || key}`;
            sub.addEventListener('click', (e) => { e.stopPropagation(); host._lateChoresOpen = false; host.onRoomTap(room); });
        }
        const rows = document.createElement('div');
        rows.className = 'dm-rp-list dm-chores-list';
        chores.forEach(c => rows.appendChild(choreRow(host, c, person)));
        nodes.push(sub, rows);
    });
    panel.replaceChildren(...nodes);
    panel.classList.add('dm-visible');
    host.renderRoot.classList.add('dm-room-panel-open');
    host._lateChoresShown = true;
    dock(host);
    return true;
}

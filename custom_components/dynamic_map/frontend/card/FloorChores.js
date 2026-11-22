import { choresState, roomChores, levelColor, choreLevel } from './Chores.js?v=3.2.1';
import { choresPanelBody } from './ChoresPanel.js?v=3.2.1';

/**
 * Floor-wide chores: Crumbs rooms that stand for a whole floor ("Second
 * floor", ha_area `second_floor`) rather than one map room. An area of the
 * chores sensor belongs to the shown floor when no room of the floor
 * matches it and either it is an HA area on that floor (floor_id
 * `floor_<n>` or level n) or its key or Crumbs name names the floor
 * ("second floor", "2nd floor", "floor 2", the floor's label). The legend
 * gets a "🏠 Whole floor" chip; a tap lists those chores in the room panel
 * (docked on wide cards, a sheet on phones) until a room is tapped or the
 * panel is closed.
 */
const ORDINALS = ['ground', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const norm = (s) => String(s || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

/** Names that mean the floor `n`, normalised. */
export function floorWords(host, n) {
    const num = Number(n);
    const suffix = num % 10 === 1 && num !== 11 ? 'st' : num % 10 === 2 && num !== 12 ? 'nd' : num % 10 === 3 && num !== 13 ? 'rd' : 'th';
    const words = [`floor ${n}`, `floor${n}`, `level ${n}`, `${n}${suffix} floor`];
    if (ORDINALS[num]) words.push(`${ORDINALS[num]} floor`);
    if (host.floorLabel) words.push(host.floorLabel(n));
    return new Set(words.map(norm));
}

function onFloor(hass, key, entry, n, words) {
    const a = hass.areas && hass.areas[key];
    if (a && a.floor_id) {
        const f = hass.floors && hass.floors[a.floor_id];
        return a.floor_id === `floor_${n}` || (f && String(f.level) === String(n));
    }
    return words.has(norm(key)) || words.has(norm(entry && entry.room));
}

/** [{key, entry}] of the shown floor's floor-wide areas (empty outside Chores mode). */
export function floorChoreAreas(host, hass) {
    if (host.mapMode !== 'chores' || !hass || host.activeFloor === undefined) return [];
    const st = choresState(host, hass);
    const areas = st && st.attributes && st.attributes.areas;
    if (!areas || typeof areas !== 'object') return [];
    const matched = new Set((host.rooms || []).map(r => roomChores(host, hass, r)).filter(Boolean));
    const words = floorWords(host, host.activeFloor);
    return Object.entries(areas)
        .filter(([key, entry]) => entry && !matched.has(entry) && onFloor(hass, key, entry, host.activeFloor, words))
        .map(([key, entry]) => ({ key, entry }));
}

const todo = (e) => (Number(e.overdue) || 0) + (Number(e.due) || 0);

/** The legend chip ("🏠 Whole floor · 2"), or null when the floor has no floor-wide area. */
export function floorChoresChip(host, hass) {
    const list = floorChoreAreas(host, hass);
    if (!list.length) return null;
    const n = list.reduce((s, { entry }) => s + todo(entry), 0);
    const worst = list.some(({ entry }) => choreLevel(entry) === 'overdue') ? 'overdue' : n ? 'due' : 'calm';
    const b = document.createElement('button');
    b.className = 'dm-cl-item dm-cl-floor';
    b.title = 'Chores for the whole floor';
    b.innerHTML = '<span class="dm-cl-dot"></span><span></span>';
    b.firstChild.style.background = levelColor(worst);
    b.lastChild.textContent = `🏠 Whole floor${n ? ` · ${n}` : ''}`;
    b.addEventListener('click', (e) => { e.stopPropagation(); openFloorChores(host); });
    return b;
}

const refresh = (host) => (host.refreshRoomPanel ? host.refreshRoomPanel() : updateFloorChores(host, host._hass));

export function openFloorChores(host) {
    host._floorChoresOpen = true;
    refresh(host);
}

export function closeFloorChores(host) {
    host._floorChoresOpen = false;
    refresh(host);
}

/**
 * Show or hide the floor list in the room panel; does nothing while a room
 * is open. `dock` lays the panel out (RoomPanel's, passed in to keep the
 * import one-way).
 */
export function updateFloorChores(host, hass, dock = () => {}) {
    const panel = host.roomPanel;
    if (!panel || host._roomPanelRoom) return;
    const list = host._floorChoresOpen ? floorChoreAreas(host, hass) : [];
    if (!list.length) {
        if (host._floorChoresShown) {
            panel.classList.remove('dm-visible', 'dm-expanded');
            host.renderRoot.classList.remove('dm-room-panel-open', 'dm-chores-dock');
        }
        host._floorChoresShown = false;
        if (host.mapMode !== 'chores') host._floorChoresOpen = false;   // back in Chores mode it starts closed
        return;
    }
    const nodes = [];
    list.forEach(({ key, entry }, i) => {
        const [head, ...body] = choresPanelBody(host, hass, { id: `floor:${key}`, name: entry.room || key, area_id: key });
        if (i === 0) {
            head.querySelector('.dm-rp-title').textContent = `🏠 ${list.length === 1 ? (entry.room || key) : 'Whole floor'}`;
            if (list.length > 1) head.querySelector('.dm-rp-count').textContent = '';
            const close = head.querySelector('.dm-rp-close');
            close.replaceWith(close.cloneNode(true));   // drop the room panel's zoom-out handler
            head.querySelector('.dm-rp-close').addEventListener('click', (e) => { e.stopPropagation(); closeFloorChores(host); });
            nodes.push(head);
        }
        if (list.length > 1) {
            const sub = document.createElement('div');
            sub.className = 'dm-rp-subhead';
            sub.textContent = `${entry.emoji ? entry.emoji + ' ' : ''}${entry.room || key}`;
            nodes.push(sub);
        }
        nodes.push(...body);
    });
    panel.replaceChildren(...nodes);
    panel.classList.add('dm-visible');
    host.renderRoot.classList.add('dm-room-panel-open');
    host._floorChoresShown = true;
    dock(host);
}

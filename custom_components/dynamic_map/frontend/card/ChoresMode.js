import { choresState, roomChores, choreLevel, levelColor } from './Chores.js?v=3.2.1';
import { badgeRadius, uprightTransform } from './RoomAlerts.js?v=3.2.1';
import { roomBox } from '../core/RoomLabels.js?v=3.2.1';
import { showRoomPanel, updateRoomPanel } from './RoomPanel.js?v=3.2.1';
import { buildWhoToggle, updateWhoToggle } from './ChoreWho.js?v=3.2.1';
import { buildChoreObjects, updateChoreObjects } from './ChoreObjects.js?v=3.2.1';
import { floorChoresChip } from './FloorChores.js?v=3.2.1';
import { lateCount, soonCount, openLateChores } from './LateChores.js?v=3.2.1';

/**
 * Lights | Chores switch. Chores mode dims the device shortcuts, colours
 * each room by its Crumbs chores and puts a due-count badge on it; a room
 * tap lists its chores (docked on the left). Every chore has a freshness
 * mark on the map (ChoreObjects.js), the legend's red "N late" chip lists
 * the late ones house-wide (LateChores.js), and a "who's doing it" switch sits lower right. The mode survives floor switches. Config:
 * `default_mode: chores`, `mode_toggle: false` (hide the built-in switch
 * and drive it from outside with `card.setMapMode('chores')`). Every change
 * fires a `dm-mode-change` event with `detail.mode`.
 */
export const MAP_MODES = ['lights', 'chores'];

export function initMapMode(host) {
    if (!MAP_MODES.includes(host.mapMode)) host.mapMode = host.config && host.config.default_mode === 'chores' ? 'chores' : 'lights';
}

export function setMapMode(host, mode) {
    if (!MAP_MODES.includes(mode)) return;
    const changed = host.mapMode !== mode;
    host.mapMode = mode;
    applyModeClass(host);
    if (!changed) return;
    host._choreBadgesSig = null;
    host.updateRoomStyles();
    updateChoresMode(host, host._hass);
    const room = host._roomPanelRoom;
    if (room) {
        if (mode === 'chores') showRoomPanel(host, room, true);
        else updateRoomPanel(host, host._hass);
        if (host.zoomToRoom) host.zoomToRoom(room);   // the chores panel docks left, the lights one floats: re-frame the room
    } else updateRoomPanel(host, host._hass);   // the floor-wide list closes in Lights mode
    host.dispatchEvent(new CustomEvent('dm-mode-change', { detail: { mode }, bubbles: true, composed: true }));
}

function applyModeClass(host) {
    if (host.renderRoot) host.renderRoot.classList.toggle('dm-mode-chores', host.mapMode === 'chores');
    if (host.modeToggle) host.modeToggle.querySelectorAll('.dm-chip').forEach(c => c.classList.toggle('active', c.dataset.mode === host.mapMode));
}

/** Build the switch, the badge layer and the legend into a freshly built map. */
export function buildChoresMode(host) {
    initMapMode(host);
    host.modeToggle = null;
    host.choreBadges = null;
    host.choresLegend = null;
    host.choresWho = null;
    host.choreObjects = null;
    host._choreBadgesSig = null;
    host._floorChoresOpen = false;
    host._floorChoresShown = false;
    host._lateChoresOpen = false;
    host._lateChoresShown = false;
    if (!host.config || host.config.chores === false) return;
    if (host.config.mode_toggle !== false && host.topLeftUI) {
        const g = document.createElement('div');
        g.className = 'dm-mode-toggle dm-chip-group';
        g.hidden = true;   // shown once the chores sensor exists
        [['lights', '💡 Lights'], ['chores', '🧹 Chores']].forEach(([mode, label]) => {
            const chip = document.createElement('div');
            chip.className = 'dm-chip';
            chip.dataset.mode = mode;
            chip.innerHTML = '<span class="dm-mode-label"></span><span class="dm-mode-count"></span>';
            chip.querySelector('.dm-mode-label').textContent = label;
            chip.addEventListener('click', (e) => { e.stopPropagation(); setMapMode(host, mode); });
            g.appendChild(chip);
        });
        host.topLeftUI.appendChild(g);
        host.modeToggle = g;
    }
    if (host.mapRoot) {
        host.choreBadges = document.createElementNS(host.svgNS, 'g');
        host.choreBadges.classList.add('dm-chore-badges');
        host.mapRoot.appendChild(host.choreBadges);
    }
    const legend = document.createElement('div');
    legend.className = 'dm-chores-legend';
    legend.hidden = true;
    host.renderRoot.appendChild(legend);
    host.choresLegend = legend;
    buildWhoToggle(host);
    buildChoreObjects(host);
    applyModeClass(host);
    if (host.mapMode === 'chores') host.updateRoomStyles();   // the scene was styled before the mode was known
    updateChoresMode(host, host._hass);   // hass usually arrived before the build
}

/** Follow hass: switch visibility, overdue count on the chip, badges and legend. */
export function updateChoresMode(host, hass) {
    const st = choresState(host, hass);
    if (host.modeToggle) {
        host.modeToggle.hidden = !st && host.mapMode !== 'chores';
        const n = st ? Number(st.state) : 0;
        host.modeToggle.querySelector('[data-mode="chores"] .dm-mode-count').textContent = n > 0 ? String(n) : '';
    }
    updateLegend(host, st, hass);
    updateBadges(host, hass);
    updateWhoToggle(host, hass);
    updateChoreObjects(host, hass);
}

function updateLegend(host, st, hass) {
    const el = host.choresLegend;
    if (!el) return;
    const a = st && st.attributes ? st.attributes : {};
    const late = st ? lateCount(host, hass) : 0;
    const counted = st ? soonCount(host, hass) : null;
    const soon = counted !== null ? counted : Number(a.due) || 0;
    const items = [];
    if (late) items.push(['overdue', `${late} late`]);
    if (soon) items.push(['due', counted !== null ? `${soon} soon` : `${soon} due today`]);
    if (!items.length && st) items.push(['calm', 'All done']);
    const floor = floorChoresChip(host, hass);
    el.hidden = host.mapMode !== 'chores' || !items.length;
    el.replaceChildren(...items.map(([level, text]) => {
        const s = document.createElement(level === 'overdue' ? 'button' : 'span');
        s.className = 'dm-cl-item';
        s.innerHTML = '<span class="dm-cl-dot"></span><span></span>';
        s.firstChild.style.background = levelColor(level);
        s.lastChild.textContent = text;
        if (level === 'overdue') {   // the late list, house-wide
            s.classList.add('dm-cl-floor', 'dm-cl-late');
            s.title = 'All late chores';
            s.addEventListener('click', (e) => { e.stopPropagation(); openLateChores(host); });
        }
        return s;
    }), ...(floor ? [floor] : []));
}

function makeBadge(host, room) {
    const svgNS = host.svgNS;
    const g = document.createElementNS(svgNS, 'g');
    g.classList.add('dm-chore-badge');
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('stroke', 'rgba(255,255,255,0.9)');
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('font-weight', '700');
    t.setAttribute('fill', 'white');
    t.style.pointerEvents = 'none';
    g.append(c, t);
    g.addEventListener('click', (e) => { e.stopPropagation(); host.onRoomTap(room); });
    host.choreBadges.appendChild(g);
    return g;
}

/** One badge per room with chores due or overdue: the count, in the worst level's colour. */
function updateBadges(host, hass) {
    if (!host.choreBadges || !hass) return;
    const r = badgeRadius(host);
    const view = `${host.isRotated ? 'r' : ''}${host.mapScaleX || 1},${host.mapScaleY || 1}@${r.toFixed(0)}`;
    const per = (host.rooms || []).map(room => {
        const e = host.mapMode === 'chores' ? roomChores(host, hass, room) : null;
        return { room, e, n: e ? (Number(e.overdue) || 0) + (Number(e.due) || 0) : 0 };
    });
    const sig = view + per.map(p => `${p.n}${choreLevel(p.e) || ''}`).join('|');
    if (sig === host._choreBadgesSig) return;
    host._choreBadgesSig = sig;
    host._choreBadgeEls = host._choreBadgeEls || {};
    const upright = uprightTransform(host);
    per.forEach(({ room, e, n }) => {
        let g = host._choreBadgeEls[room.id];
        if (g && !host.choreBadges.contains(g)) g = null;   // rebuilt map
        if (!n) { if (g) g.style.display = 'none'; return; }
        if (!g) g = host._choreBadgeEls[room.id] = makeBadge(host, room);
        const c = g.querySelector('circle'), t = g.querySelector('text');
        c.setAttribute('r', r.toFixed(1));
        c.setAttribute('stroke-width', (r * 0.18).toFixed(1));
        c.setAttribute('fill', levelColor(choreLevel(e)));
        t.setAttribute('font-size', (r * 1.25).toFixed(1));
        t.textContent = n > 9 ? '9+' : String(n);
        const box = roomBox(room, host.imgW, host.imgH);
        const x = box.cx + box.w / 2 - r * 1.6, y = box.cy - box.h / 2 + r * 1.6;
        g.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)})${upright}`);
        g.style.display = 'block';
    });
}

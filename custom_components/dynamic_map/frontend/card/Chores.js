/**
 * House chores from the Crumbs integration (sensor.crumbs_house_chores).
 * `attributes.areas` is keyed by the HA area each Crumbs room is linked
 * to: { due, overdue, people: [{id, name}], chores: [...] }. In Chores
 * mode a room is coloured by its worst chore: overdue (jam red), due
 * today (amber), otherwise calm green. A room without an entry stays plain.
 * Config: `chores_entity` (default below), `chores: false` hides the mode.
 */

export const DEFAULT_CHORES_ENTITY = 'sensor.crumbs_house_chores';

const LEVEL_RGB = {
    overdue: 'rgb(190, 30, 70)',
    due: 'rgb(245, 158, 11)',
    calm: 'rgb(34, 197, 94)'
};

/**
 * Width in px of the chores panel docked on the left (0 = not docked): in
 * Chores mode on any card at least DOCK_MIN_W wide, the wall tablet held
 * upright included; phones keep the bottom sheet.
 */
const DOCK_MIN_W = 600;
export function choresDockWidth(host, cardW) {
    if (host.mapMode !== 'chores' || !(cardW >= DOCK_MIN_W) || (host.config && host.config.chores === false)) return 0;
    return Math.round(Math.min(340, Math.max(260, cardW * 0.34)));
}

export function choresEntityId(config) {
    return (config && config.chores_entity) || DEFAULT_CHORES_ENTITY;
}

/** The chores sensor's state object, or null when Chores is off or the sensor is missing. */
export function choresState(host, hass) {
    if (!host.config || host.config.chores === false || !hass || !hass.states) return null;
    return hass.states[choresEntityId(host.config)] || null;
}

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * The Crumbs entry for a map room: by the room's HA area id, then
 * case-insensitively by that area's name or the room's own name.
 */
export function roomChores(host, hass, room) {
    const st = choresState(host, hass);
    const areas = st && st.attributes && st.attributes.areas;
    if (!areas || typeof areas !== 'object') return null;
    if (room.area_id && areas[room.area_id]) return areas[room.area_id];
    const names = [room.area_id, hass.areas && room.area_id && hass.areas[room.area_id] ? hass.areas[room.area_id].name : null, room.name]
        .map(norm).filter(Boolean);
    const key = Object.keys(areas).find(k => names.includes(norm(k)));
    return key ? areas[key] : null;
}

const STATE_LEVEL = { late: 'overdue', soon: 'due', ok: 'calm', done: 'calm' };

/**
 * 'overdue' | 'due' | 'calm' for an area entry: from its Crumbs `state`
 * (its worst chore's freshness) when the sensor carries one, else from the
 * overdue / due-today counts.
 */
export function choreLevel(entry) {
    if (!entry) return null;
    if (STATE_LEVEL[entry.state]) return STATE_LEVEL[entry.state];
    if (Number(entry.overdue) > 0) return 'overdue';
    if (Number(entry.due) > 0) return 'due';
    return 'calm';
}

export function levelColor(level) {
    return LEVEL_RGB[level] || null;
}

/** Room fill colour in Chores mode, or null (room not linked to a Crumbs room). */
export function choreTint(host, hass, room) {
    return levelColor(choreLevel(roomChores(host, hass, room)));
}

/** Signature of every room's chore look, so the map restyles only when it changed. */
export function choresSignature(host, hass) {
    if (host.mapMode !== 'chores') return '';
    return 'c:' + (host.rooms || []).map(r => {
        const e = roomChores(host, hass, r);
        return e ? `${choreLevel(e)}${e.overdue || 0}/${e.due || 0}${e.state || ''}` : '-';
    }).join('|');
}

/** Chores in display order: most late first, then due today, then by next due date. */
export function sortedChores(entry) {
    const list = (entry && Array.isArray(entry.chores)) ? entry.chores.slice() : [];
    const rank = (c) => (c.late_days > 0 ? 0 : c.due ? 1 : 2);
    return list.sort((a, b) => rank(a) - rank(b)
        || (b.late_days || 0) - (a.late_days || 0)
        || String(a.due_on || '9999').localeCompare(String(b.due_on || '9999'))
        || String(a.title || '').localeCompare(String(b.title || '')));
}

const DAY_MS = 86400000;
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole local days from `iso` to `now` (negative in the future), or null. */
export function daysSince(iso, now = new Date()) {
    if (!iso) return null;
    // A bare date (YYYY-MM-DD) is a local calendar day, not UTC midnight.
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return Math.round((dayStart(now) - dayStart(d)) / DAY_MS);
}

/** "last done 3 d ago · Diana", "done today · Costin", "never done". */
export function lastDoneText(chore, now = new Date()) {
    const n = daysSince(chore.last_done, now);
    if (n === null) return 'never done';
    const when = n <= 0 ? 'done today' : n === 1 ? 'done yesterday' : `last done ${n} d ago`;
    return chore.last_done_by ? `${when} · ${chore.last_done_by}` : when;
}

/** Status pill text, and its level from the chore's freshness (a "soon" one is amber days ahead). */
export function choreStatus(chore, now = new Date()) {
    const level = STATE_LEVEL[choreState(chore, now)] || 'calm';
    if (chore.late_days > 0) return { text: `${chore.late_days} d late`, level: 'overdue' };
    if (chore.due) return { text: 'due today', level: 'due' };
    const n = daysSince(chore.due_on, now);
    if (n === null) return { text: '', level };
    return { text: n >= 0 ? 'due today' : n === -1 ? 'tomorrow' : `in ${-n} d`, level };
}

/**
 * Freshness marks (Crumbs `state`): done = in the first 20% of the cycle
 * after a finish (green ✓), ok = 20–80% (gray), soon = the last 20%, due day
 * included (yellow !), late = past the due date (red !).
 */
export const CHORE_MARKS = {
    done: { color: 'rgb(34, 197, 94)', glyph: '✓', label: 'done recently' },
    ok: { color: 'rgb(148, 163, 184)', glyph: '', label: 'not due yet' },
    soon: { color: 'rgb(245, 158, 11)', glyph: '!', label: 'due soon' },
    late: { color: 'rgb(190, 30, 70)', glyph: '!', label: 'late' }
};

/**
 * A chore's freshness: Crumbs' `state` when present, else the same rule
 * from late_days / due / last_done and the rhythm (older sensors).
 */
export function choreState(chore, now = new Date()) {
    if (!chore) return null;
    if (CHORE_MARKS[chore.state]) return chore.state;
    if (chore.late_days > 0) return 'late';
    if (chore.due) return 'soon';
    const period = Number(chore.period_days || chore.every_days);
    const since = daysSince(chore.last_done, now);
    if (period > 0 && since !== null) {
        const p = since / period;
        if (p < 0.2) return 'done';
        if (p >= 0.8) return 'soon';
    }
    return 'ok';
}

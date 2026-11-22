import { choresState } from './Chores.js?v=3.2.1';

/**
 * "Who's doing it" switch, lower right in Chores mode: one chip per person
 * the Crumbs rooms can credit. Every done button (panel rows, object
 * checks) credits the selected person. The choice is kept per device in
 * localStorage; with nothing stored (or a person who left) it is the first.
 */
const STORE_KEY = 'dm-chores-who';

/** Everyone listed on any Crumbs room, in first-seen order, deduplicated by id. */
export function chorePeople(host, hass) {
    const st = choresState(host, hass);
    const areas = (st && st.attributes && st.attributes.areas) || {};
    const seen = new Map();
    Object.values(areas).forEach(a => (Array.isArray(a && a.people) ? a.people : []).forEach(p => {
        if (p && p.id !== undefined && !seen.has(String(p.id))) seen.set(String(p.id), p);
    }));
    return [...seen.values()];
}

function storedId() {
    try { return globalThis.localStorage ? localStorage.getItem(STORE_KEY) : null; } catch (e) { return null; }
}

/** The person to credit from `people`, or null when there is nobody. */
export function selectedPerson(host, people) {
    if (!people || !people.length) return null;
    const id = host._choreWho !== undefined ? host._choreWho : storedId();
    return people.find(p => String(p.id) === String(id)) || people[0];
}

export function setSelectedPerson(host, id) {
    host._choreWho = String(id);
    try { if (globalThis.localStorage) localStorage.setItem(STORE_KEY, String(id)); } catch (e) { /* private mode: this session only */ }
    updateWhoToggle(host, host._hass);
    if (host.refreshRoomPanel) host.refreshRoomPanel();   // the open room or the floor-wide list
}

export function buildWhoToggle(host) {
    const el = document.createElement('div');
    el.className = 'dm-chores-who dm-chip-group';
    el.hidden = true;
    el.setAttribute('role', 'radiogroup');
    el.setAttribute('aria-label', "Who's doing the chores");
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('click', e => e.stopPropagation());
    host.renderRoot.appendChild(el);
    host.choresWho = el;
    host._choreWhoSig = null;
}

/** Shown in Chores mode when someone can be credited; chips rebuilt only when the people change. */
export function updateWhoToggle(host, hass) {
    const el = host.choresWho;
    if (!el) return;
    const people = host.mapMode === 'chores' ? chorePeople(host, hass) : [];
    el.hidden = !people.length;
    const sig = people.map(p => `${p.id}:${p.name}`).join('|');
    if (sig !== host._choreWhoSig) {
        host._choreWhoSig = sig;
        el.replaceChildren(...people.map(p => {
            const chip = document.createElement('button');
            chip.className = 'dm-chip dm-who-chip';
            chip.dataset.person = String(p.id);
            chip.setAttribute('role', 'radio');
            chip.textContent = p.name;
            chip.title = `Credit chores to ${p.name}`;
            chip.addEventListener('click', () => setSelectedPerson(host, p.id));
            return chip;
        }));
    }
    const sel = selectedPerson(host, people);
    el.querySelectorAll('.dm-who-chip').forEach(c => {
        const on = !!sel && c.dataset.person === String(sel.id);
        c.classList.toggle('active', on);
        c.setAttribute('aria-checked', on ? 'true' : 'false');
    });
}

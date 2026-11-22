import { roomChores, sortedChores, lastDoneText, choreStatus } from './Chores.js?v=3.2.1';
import { chorePeople, selectedPerson } from './ChoreWho.js?v=3.2.1';

/**
 * Room panel body in Chores mode: one row per Crumbs chore with its
 * status ("2 d late", "due today", "in 3 d"), "last done N d ago · who"
 * and one Done button that credits the person picked in the "who's doing
 * it" switch (ChoreWho.js). A press calls
 * crumbs.complete_chore {task_id, done_by}; the button stays marked until
 * the sensor shows the new last_done (or BUSY_MS passes), and a refusal
 * (service_validation_error) is shown under the chore.
 */
const BUSY_MS = 15000;

export function choresHeader(host, room, entry) {
    const h = document.createElement('div');
    h.className = 'dm-rp-head';
    h.innerHTML = `<span class="dm-rp-title"></span><span class="dm-rp-count"></span><button class="dm-rp-close" title="Close">✕</button>`;
    h.querySelector('.dm-rp-title').textContent = `${entry && entry.emoji ? entry.emoji + ' ' : ''}${room.name || (entry && entry.room) || 'Room'}`;
    const n = entry ? (Number(entry.overdue) || 0) + (Number(entry.due) || 0) : 0;
    h.querySelector('.dm-rp-count').textContent = n ? `${n} to do` : '';
    h.querySelector('.dm-rp-close').addEventListener('click', () => host.zoomOutToDefault());
    return h;
}

/** The panel's nodes after the grip: header, then the chore list or a hint. */
export function choresPanelBody(host, hass, room, now = new Date()) {
    const entry = roomChores(host, hass, room);
    const out = [choresHeader(host, room, entry)];
    if (!entry) {
        const d = document.createElement('div');
        d.className = 'dm-rp-empty';
        d.textContent = room.area_id
            ? 'No Crumbs room is linked to this area. Set "Home Assistant area" on the room in Crumbs.'
            : 'Link this room to a Home Assistant area in the editor to see its chores.';
        out.push(d);
        return out;
    }
    const chores = sortedChores(entry);
    if (!chores.length) {
        const d = document.createElement('div');
        d.className = 'dm-rp-empty';
        d.textContent = 'No chores in this room.';
        out.push(d);
        return out;
    }
    const list = document.createElement('div');
    list.className = 'dm-rp-list dm-chores-list';
    const person = selectedPerson(host, chorePeople(host, hass));
    chores.forEach(c => list.appendChild(choreRow(host, c, person, now)));
    out.push(list);
    return out;
}

/** The pending press on a chore ({who, at, lastDone}), or null once the sensor moved or BUSY_MS passed. */
export function choreBusy(host, chore) {
    const b = (host._choreBusy || {})[chore.id];
    if (!b) return null;
    if (b.lastDone !== chore.last_done || Date.now() - b.at > BUSY_MS) { delete host._choreBusy[chore.id]; return null; }
    return b;
}

/** Credit `person` with `chore` (panel row or object check); a refusal is kept for the panel. */
export function completeChore(host, chore, person) {
    if (!host._hass || !person) return;
    host._choreBusy = host._choreBusy || {};
    host._choreErr = host._choreErr || {};
    host._choreBusy[chore.id] = { who: person.id, name: person.name, at: Date.now(), lastDone: chore.last_done };
    delete host._choreErr[chore.id];
    const rerender = () => {
        if (host.refreshRoomPanel) host.refreshRoomPanel();   // the open room or the floor-wide list
    };
    let ret;
    try { ret = host._hass.callService('crumbs', 'complete_chore', { task_id: chore.id, done_by: person.id }); } catch (e) { ret = Promise.reject(e); }
    Promise.resolve(ret).catch((e) => {
        delete host._choreBusy[chore.id];
        host._choreErr[chore.id] = (e && e.message) || `Could not credit ${person.name}`;
        rerender();
    });
    rerender();
}

function choreRow(host, chore, person, now) {
    const st = choreStatus(chore, now);
    const r = document.createElement('div');
    r.className = `dm-chore-row dm-chore-${st.level}`;
    r.innerHTML = `<div class="dm-chore-main"><span class="dm-chore-title"></span><span class="dm-chore-status"></span></div><div class="dm-chore-sub"></div><div class="dm-chore-who"></div>`;
    r.querySelector('.dm-chore-title').textContent = chore.title || 'Chore';
    r.querySelector('.dm-chore-status').textContent = st.text;
    r.querySelector('.dm-chore-sub').textContent = lastDoneText(chore, now) + (chore.assignee ? ` · for ${chore.assignee}` : '');
    const busy = choreBusy(host, chore);
    if (person || busy) {
        const b = document.createElement('button');
        b.className = 'dm-rp-btn dm-chore-done';
        b.textContent = busy ? `✓ ${busy.name || 'Done'}` : `Done · ${person.name}`;
        b.title = person ? `${person.name} did "${chore.title}"` : '';
        b.disabled = !!busy;
        b.classList.toggle('dm-on', !!busy);
        b.addEventListener('click', (e) => { e.stopPropagation(); completeChore(host, chore, person); });
        r.querySelector('.dm-chore-who').appendChild(b);
    }
    const err = (host._choreErr || {})[chore.id];
    if (err) {
        const d = document.createElement('div');
        d.className = 'dm-chore-error';
        d.textContent = err;
        r.appendChild(d);
    }
    return r;
}

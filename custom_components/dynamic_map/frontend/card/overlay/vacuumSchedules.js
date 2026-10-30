/**
 * Vacuum cleaning schedules: a bottom sheet listing the vacuum's schedules
 * (switch on/off, edit, delete) with a form to add or change one. HA owns
 * them: the list is `sensor.vacuum_schedules`, edits go through the
 * dynamic_map.save/delete/run_vacuum_schedule services.
 */
export const SCHEDULES_ENTITY = 'sensor.vacuum_schedules';
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MODES = [['vac_mop', 'Vac & Mop'], ['vacuum', 'Vacuum only'], ['mop', 'Mop only']];
const pretty = (v) => String(v).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/** "Mon–Fri", "Weekends", "Every day" or a day list, for days 0 (Mon)…6. */
export function daysLabel(days) {
    const d = [...days].sort((a, b) => a - b).join(',');
    if (d === '0,1,2,3,4,5,6') return 'Every day';
    if (d === '0,1,2,3,4') return 'Weekdays';
    if (d === '5,6') return 'Weekends';
    return days.map(i => DAYS[i]).join(' ');
}

/** The schedules of one vacuum and what it offers, from the sensor's attributes. */
export function schedulesFor(hass, target, entity = SCHEDULES_ENTITY) {
    const attrs = hass?.states?.[entity]?.attributes || {};
    return {
        available: !!hass?.states?.[entity],
        schedules: (attrs.schedules || []).filter(s => s.entity_id === target)
            .sort((a, b) => a.time.localeCompare(b.time)),
        offer: (attrs.vacuums || {})[target] || { rooms: [], suction: [], water: [], route: [] }
    };
}

/** A one-line summary: rooms, mode and passes. */
export function scheduleSummary(s) {
    const rooms = s.rooms && s.rooms.length ? s.rooms.join(', ') : 'Whole house';
    const mode = (MODES.find(m => m[0] === s.mode) || MODES[0])[1];
    return `${rooms} · ${mode}${s.repeat > 1 ? ` · ${s.repeat}×` : ''}`;
}

function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

function selectOf(options, value, blank) {
    const sel = h('select', 'dm-rs-select');
    const all = blank ? [['', blank], ...options] : options;
    all.forEach(([v, label]) => { const o = h('option', '', label); o.value = v; sel.appendChild(o); });
    sel.value = value ?? '';
    return sel;
}

function chips(labels, picked) {
    const row = h('div', 'dm-sc-chips');
    labels.forEach((label, i) => {
        const c = h('button', 'dm-sc-chip', label);
        c.type = 'button';
        c.setAttribute('aria-pressed', String(picked.has(i)));
        c.onclick = () => {
            picked.has(i) ? picked.delete(i) : picked.add(i);
            c.setAttribute('aria-pressed', String(picked.has(i)));
        };
        row.appendChild(c);
    });
    return row;
}

export function showSchedulesSheet(mapContext, target, act = {}) {
    if (mapContext.activeOverlay) { mapContext.activeOverlay.remove(); mapContext.activeOverlay = null; }
    if (mapContext.schedulesUI) mapContext.schedulesUI.remove();
    const entity = act.schedules_entity || SCHEDULES_ENTITY;
    const ui = h('div', 'dm-room-select dm-sched');
    mapContext.schedulesUI = ui;
    const call = (service, data) => mapContext._hass.callService('dynamic_map', service, data)
        .catch(err => { status.textContent = `⚠ ${err?.message || err}`; throw err; });
    const status = h('div', 'dm-sc-status');
    let seen = null, editing = false;
    const close = () => { clearInterval(timer); ui.remove(); mapContext.schedulesUI = null; };

    const header = () => {
        const top = h('div', 'dm-rs-row dm-sc-head');
        top.appendChild(h('div', 'dm-rs-title', editing ? 'Schedule' : 'Cleaning schedules'));
        const x = h('button', 'dm-rs-btn dm-sc-x', '✕');
        x.type = 'button'; x.title = 'Close'; x.onclick = close;
        top.appendChild(x);
        return top;
    };

    const renderList = () => {
        editing = false;
        const { available, schedules } = schedulesFor(mapContext._hass, target, entity);
        const list = h('div', 'dm-sc-list');
        if (!available) list.appendChild(h('div', 'dm-sc-empty', 'Schedules need the Dynamic Map integration update.'));
        else if (!schedules.length) list.appendChild(h('div', 'dm-sc-empty', 'No schedules yet.'));
        schedules.forEach(s => list.appendChild(row(s)));
        const add = h('button', 'dm-rs-btn dm-rs-start dm-ready', '＋ Add schedule');
        add.type = 'button';
        add.onclick = () => renderForm({ time: '10:00', days: [0, 1, 2, 3, 4, 5, 6], rooms: [], mode: 'vac_mop', repeat: 1 });
        ui.replaceChildren(header(), list, status, add);
    };

    const row = (s) => {
        const r = h('div', 'dm-sc-row');
        const sw = h('div', 'dm-ov-switch');
        sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-checked', String(!!s.enabled));
        sw.classList.toggle('dm-on', !!s.enabled);
        sw.appendChild(h('div', 'dm-ov-thumb'));
        sw.onclick = () => {
            sw.classList.toggle('dm-on', !s.enabled);
            call('save_vacuum_schedule', { id: s.id, enabled: !s.enabled }).catch(() => sw.classList.toggle('dm-on', !!s.enabled));
        };
        const text = h('div', 'dm-sc-text');
        text.appendChild(h('div', 'dm-sc-when', `${s.time} · ${daysLabel(s.days)}${s.name ? ` · ${s.name}` : ''}`));
        text.appendChild(h('div', 'dm-sc-what', scheduleSummary(s)));
        text.onclick = () => renderForm(s);
        const del = h('button', 'dm-rs-btn dm-sc-del', '🗑');
        del.type = 'button'; del.title = 'Delete';
        del.onclick = () => {
            if (!del.classList.contains('dm-ov-armed')) { del.classList.add('dm-ov-armed'); del.title = 'Tap again to delete'; return; }
            call('delete_vacuum_schedule', { id: s.id }).catch(() => {});
        };
        r.append(sw, text, del);
        return r;
    };

    const renderForm = (s) => {
        editing = true;
        const { offer } = schedulesFor(mapContext._hass, target, entity);
        // Keep the saved value even before HA knows the robot's options (just after a restart).
        const opt = (list, what, saved) => [...new Set([...(list || []), ...(saved ? [saved] : [])])]
            .map(v => [v, `${what}: ${pretty(v)}`]);
        const name = h('input', 'dm-rs-select'); name.placeholder = 'Name (optional)'; name.value = s.name || '';
        const time = h('input', 'dm-rs-select'); time.type = 'time'; time.value = s.time;
        const days = new Set(s.days);
        const roomNames = [...new Set([...(offer.rooms || []), ...(s.rooms || [])])];
        const rooms = new Set(roomNames.map((n, i) => (s.rooms || []).includes(n) ? i : -1).filter(i => i >= 0));
        const mode = selectOf(MODES, s.mode);
        const suction = selectOf(opt(offer.suction, 'Suction', s.suction), s.suction, 'Suction: as is');
        const water = selectOf(opt(offer.water, 'Water', s.water), s.water, 'Water: as is');
        const route = selectOf(opt(offer.route, 'Route', s.route), s.route, 'Route: as is');
        const passes = selectOf([['1', '1 pass'], ['2', '2 passes'], ['3', '3 passes']], String(s.repeat || 1));
        const label = (t) => h('div', 'dm-sc-label', t);
        const save = h('button', 'dm-rs-btn dm-rs-start dm-ready', 'Save'); save.type = 'button';
        const back = h('button', 'dm-rs-btn dm-rs-cancel', 'Back'); back.type = 'button';
        back.onclick = renderList;
        save.onclick = () => {
            if (!days.size || !time.value) { status.textContent = 'Pick a time and at least one day.'; return; }
            const data = {
                name: name.value.trim(), time: time.value.slice(0, 5), days: [...days].sort(), entity_id: target,
                rooms: roomNames.filter((_, i) => rooms.has(i)), mode: mode.value, repeat: Number(passes.value),
                suction: suction.value || null, water: water.value || null, route: route.value || null
            };
            if (s.id) data.id = s.id; else data.enabled = true;
            call('save_vacuum_schedule', data).then(() => { seen = null; renderList(); }).catch(() => {});
        };
        const btns = h('div', 'dm-rs-row'); btns.append(back, save);
        status.textContent = '';
        const form = h('div', 'dm-sc-form');
        form.append(name, label('Time'), time, label('Days'), chips(DAYS, days),
            label('Rooms (none = whole house)'), chips(roomNames, rooms),
            label('Cleaning'), mode, suction, water, route, passes);
        ui.replaceChildren(header(), form, status, btns);
    };

    // Follow HA: redraw the list whenever the sensor changes (not while editing).
    const timer = setInterval(() => {
        if (!ui.isConnected) { clearInterval(timer); return; }
        const now = mapContext._hass?.states?.[entity];
        if (now !== seen && !editing) { seen = now; renderList(); }
    }, 400);
    seen = mapContext._hass?.states?.[entity];
    renderList();
    mapContext.renderRoot.appendChild(ui);
    return ui;
}

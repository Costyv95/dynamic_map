/**
 * Search index over everything the card can jump to: badges and rooms of
 * every floor, plus HA entities of linked areas. Pure functions; the UI
 * lives in Search.js.
 */

/** Entries for one floor's data. `hass` adds friendly names and area entities. */
export function indexFloor(floor, { rooms = [], shortcuts = [] }, hass, floorLabel = (f) => `Floor ${f}`) {
    const out = [];
    const seen = new Set();
    const label = floorLabel(floor);
    shortcuts.forEach(sc => {
        const st = sc.entity_id && hass && hass.states ? hass.states[sc.entity_id] : null;
        const friendly = st && st.attributes && st.attributes.friendly_name;
        const name = sc.name || friendly || (sc.entity_id ? sc.entity_id.split('.')[1].replace(/_/g, ' ') : '');
        if (!name) return;
        out.push({ kind: 'badge', floor, id: sc.id, entity: sc.entity_id || null, name, sub: [friendly && friendly !== name ? friendly : null, label].filter(Boolean).join(' · '), icon: sc.type === 'sensor' ? '📟' : (sc.config && sc.config.icon && !/^mdi:/.test(sc.config.icon) ? sc.config.icon : '📍') });
        if (sc.entity_id) seen.add(sc.entity_id);
    });
    rooms.forEach(room => {
        if (room.name) out.push({ kind: 'room', floor, id: room.id, name: room.name, sub: label, icon: '🏠', areaId: room.area_id || null });
    });
    if (hass && hass.entities && hass.states) {
        const devices = hass.devices || {};
        rooms.filter(r => r.area_id).forEach(room => {
            for (const [id, ent] of Object.entries(hass.entities)) {
                if (seen.has(id) || ent.hidden || ent.disabled_by || ent.entity_category) continue;
                const area = ent.area_id || (ent.device_id && devices[ent.device_id] ? devices[ent.device_id].area_id : null);
                if (area !== room.area_id || !hass.states[id]) continue;
                const name = (hass.states[id].attributes && hass.states[id].attributes.friendly_name) || id;
                out.push({ kind: 'entity', floor, id, entity: id, roomId: room.id, name, sub: `${room.name || 'Room'} · ${label}`, icon: '•' });
                seen.add(id);
            }
        });
    }
    return out;
}

/** Ranked matches for `query`: prefix beats word start beats substring; badges and rooms before plain entities. */
export function matchIndex(entries, query, limit = 8) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const rank = { badge: 0, room: 0, entity: 1 };
    const score = (e) => {
        const n = e.name.toLowerCase();
        const idp = (e.entity || '').toLowerCase();
        if (n.startsWith(q)) return 0;
        if (n.split(/[\s_-]+/).some(w => w.startsWith(q))) return 1;
        if (n.includes(q)) return 2;
        if (idp.includes(q)) return 3;
        return -1;
    };
    return entries.map(e => ({ e, s: score(e) })).filter(x => x.s >= 0)
        .sort((a, b) => a.s - b.s || rank[a.e.kind] - rank[b.e.kind] || a.e.name.localeCompare(b.e.name))
        .slice(0, limit).map(x => x.e);
}

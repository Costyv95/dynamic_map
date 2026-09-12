import { roomOfBadge } from './BadgeRoom.js?v=3.2.1';
import { vacuumIndex } from './VacuumEntities.js?v=3.2.1';

/**
 * Robot vacuum to-dos on the map: water to add or empty, consumables due,
 * dock or robot errors. The entities come from the robot's own device and
 * its dock, looked up by translation key so renames do not lose a to-do
 * (see VacuumEntities). Each alert can carry an `action` (a button press)
 * that clears it, e.g. after cleaning the sensors.
 */
const CONSUMABLES = [
    { key: 'sensor_time_left', label: 'Clean the sensors', reset: 'reset_sensor_consumable' },
    { key: 'main_brush_time_left', label: 'Replace the main brush', reset: 'reset_main_brush_consumable' },
    { key: 'side_brush_time_left', label: 'Replace the side brush', reset: 'reset_side_brush_consumable' },
    { key: 'filter_time_left', label: 'Replace the filter', reset: 'reset_air_filter_consumable' },
    { key: 'strainer_time_left', id: 'dock_strainer_time_left', label: 'Clean the dock strainer', reset: 'reset_dock_strainer_consumable', resetId: 'dock_reset_strainer_consumable' },
    { key: 'cleaning_brush_time_left', id: 'dock_maintenance_brush_time_left', label: 'Clean the dock brush', reset: 'reset_dock_cleaning_brush_consumable', resetId: 'dock_reset_cleaning_brush_consumable' }
];
/** Labels for problem sensors, by translation key and by entity-id suffix. */
const PROBLEMS = {
    water_shortage: 'Add water to the robot',
    clean_box_empty: 'Fill the dock\'s clean water tank', dock_clean_water_box: 'Fill the dock\'s clean water tank',
    dirty_box_full: 'Empty the dock\'s dirty water tank', dock_dirty_water_box: 'Empty the dock\'s dirty water tank'
};
const ERRORS = [{ key: 'vacuum_error', label: 'Robot error' }, { key: 'dock_error', id: 'dock_dock_error', label: 'Dock error' }];
const OK = ['ok', 'none', 'unknown', 'unavailable', ''];

/** Alerts for one vacuum entity id: [{ id, kind: 'vacuum'|'danger', name, icon, action? }]. */
export function vacuumAlerts(hass, vacuumId) {
    if (!hass || !hass.states || !vacuumId || !hass.states[vacuumId]) return [];
    const idx = vacuumIndex(hass, vacuumId);
    const robot = (hass.states[vacuumId].attributes || {}).friendly_name || idx.slug;
    const st = (id) => hass.states[id];
    const out = [];
    ERRORS.forEach(({ key, id, label }) => {
        const found = idx.find('sensor', key, id);
        const s = found && st(found);
        if (s && !OK.includes(String(s.state).toLowerCase())) out.push({ id: found, kind: 'danger', name: `${label}: ${String(s.state).replace(/_/g, ' ')}`, icon: '🤖' });
    });
    idx.binarySensors().forEach(id => {
        const s = st(id);
        if (!s || s.state !== 'on' || (s.attributes || {}).device_class !== 'problem') return;
        const e = (hass.entities || {})[id] || {};
        const suffix = id.slice(`binary_sensor.${idx.slug}_`.length);
        const label = PROBLEMS[e.translation_key] || PROBLEMS[suffix] || (s.attributes || {}).friendly_name || suffix;
        out.push({ id, kind: 'vacuum', name: label, icon: '🤖' });
    });
    CONSUMABLES.forEach(({ key, id, label, reset, resetId }) => {
        const found = idx.find('sensor', key, id);
        const s = found && st(found);
        if (!s || !Number.isFinite(Number(s.state)) || Number(s.state) > 0) return;
        const btn = idx.find('button', reset, resetId);
        out.push({ id: found, kind: 'vacuum', name: label, icon: '🤖', action: btn ? { domain: 'button', service: 'press', data: { entity_id: btn }, label: 'Done' } : null });
    });
    return out.map(a => ({ ...a, robot }));
}

/** Vacuums the card knows about: vacuum badges on the floor plus the card's `vacuum_entity`. */
export function knownVacuums(host) {
    const ids = (host.shortcuts || []).filter(sc => sc.type === 'vacuum' && sc.entity_id).map(sc => sc.entity_id);
    if (host.config && host.config.vacuum_entity) ids.push(host.config.vacuum_entity);
    return [...new Set(ids)];
}

/** The room a vacuum's to-dos show in: its badge's room, its HA area's room, else the room named by its "current room" sensor. */
export function vacuumRoom(host, hass, vacuumId) {
    const rooms = host.rooms || [];
    const badge = (host.shortcuts || []).find(sc => sc.type === 'vacuum' && sc.entity_id === vacuumId);
    const byBadge = badge ? roomOfBadge(rooms, badge) : null;
    if (byBadge) return byBadge;
    const ent = hass && hass.entities ? hass.entities[vacuumId] : null;
    const area = ent ? (ent.area_id || (ent.device_id && hass.devices && hass.devices[ent.device_id] ? hass.devices[ent.device_id].area_id : null)) : null;
    const byArea = area ? rooms.find(r => r.area_id === area) : null;
    if (byArea) return byArea;
    const curId = hass && hass.states ? vacuumIndex(hass, vacuumId).find('sensor', 'current_room') : null;
    const cur = curId ? hass.states[curId] : null;
    if (cur && cur.state) return rooms.find(r => (r.name || '').toLowerCase() === String(cur.state).toLowerCase()) || null;
    return null;
}

/** Vacuum alerts that belong to `room`, filtered by the enabled kinds. */
export function roomVacuumAlerts(host, hass, room, kinds) {
    if (!host || !room) return [];
    return knownVacuums(host).flatMap(id => {
        const target = vacuumRoom(host, hass, id);
        if (!target || target.id !== room.id) return [];
        return vacuumAlerts(hass, id).filter(a => kinds.includes(a.kind));
    });
}

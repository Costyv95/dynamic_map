import { roomOfBadge } from './BadgeRoom.js?v=3.2.1';

/**
 * Robot vacuum to-dos on the map: water to add or empty, consumables due,
 * dock or robot errors. Derived from the entities the Roborock (and
 * similar) integrations create next to the vacuum entity. Each alert can
 * carry an `action` (a button press) that clears it, e.g. after cleaning
 * the sensors.
 */
const CONSUMABLES = [
    ['sensor_time_left', 'Clean the sensors', 'reset_sensor_consumable'],
    ['main_brush_time_left', 'Replace the main brush', 'reset_main_brush_consumable'],
    ['side_brush_time_left', 'Replace the side brush', 'reset_side_brush_consumable'],
    ['filter_time_left', 'Replace the filter', 'reset_air_filter_consumable'],
    ['dock_strainer_time_left', 'Clean the dock strainer', 'dock_reset_strainer_consumable'],
    ['dock_maintenance_brush_time_left', 'Clean the dock brush', 'dock_reset_cleaning_brush_consumable']
];
const PROBLEMS = { water_shortage: 'Add water to the robot', dock_clean_water_box: 'Fill the dock\'s clean water tank', dock_dirty_water_box: 'Empty the dock\'s dirty water tank' };
const ERRORS = [['vacuum_error', 'Robot error'], ['dock_dock_error', 'Dock error']];
const OK = ['ok', 'none', 'unknown', 'unavailable', ''];

/** Alerts for one vacuum entity id: [{ id, kind: 'vacuum'|'danger', name, icon, action? }]. */
export function vacuumAlerts(hass, vacuumId) {
    if (!hass || !hass.states || !vacuumId || !hass.states[vacuumId]) return [];
    const p = vacuumId.split('.')[1];
    const robot = (hass.states[vacuumId].attributes || {}).friendly_name || p;
    const st = (id) => hass.states[id];
    const out = [];
    ERRORS.forEach(([suffix, label]) => {
        const s = st(`sensor.${p}_${suffix}`);
        if (s && !OK.includes(String(s.state).toLowerCase())) out.push({ id: `sensor.${p}_${suffix}`, kind: 'danger', name: `${label}: ${String(s.state).replace(/_/g, ' ')}`, icon: '🤖' });
    });
    Object.keys(hass.states).forEach(id => {
        if (!id.startsWith(`binary_sensor.${p}_`)) return;
        const s = st(id);
        if (s.state !== 'on' || (s.attributes || {}).device_class !== 'problem') return;
        const suffix = id.slice(`binary_sensor.${p}_`.length);
        out.push({ id, kind: 'vacuum', name: PROBLEMS[suffix] || `${(s.attributes || {}).friendly_name || suffix}`, icon: '🤖' });
    });
    CONSUMABLES.forEach(([suffix, label, reset]) => {
        const s = st(`sensor.${p}_${suffix}`);
        if (!s || !Number.isFinite(Number(s.state)) || Number(s.state) > 0) return;
        const btn = `button.${p}_${reset}`;
        out.push({ id: `sensor.${p}_${suffix}`, kind: 'vacuum', name: label, icon: '🤖', action: st(btn) ? { domain: 'button', service: 'press', data: { entity_id: btn }, label: 'Done' } : null });
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
    const cur = hass && hass.states ? hass.states[`sensor.${vacuumId.split('.')[1]}_current_room`] : null;
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

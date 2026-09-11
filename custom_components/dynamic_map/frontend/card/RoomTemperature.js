/**
 * Opt-in room temperature tint: `room_temperature: true` colours every
 * room by its temperature, cool blue to warm red across
 * `temperature_range` (default 16..28 °C). A room's reading comes from,
 * in order: the room's own `temperature_entity`, a sensor badge parented
 * to the room, or the first temperature sensor in the room's HA area.
 */

import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.1';

const COOL = [59, 130, 246];   // blue
const MID = [16, 185, 129];    // green
const WARM = [249, 115, 22];   // orange
const HOT = [239, 68, 68];     // red

function mix(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

/** rgb() for a temperature inside [min, max]. */
export function tempColor(t, min = 16, max = 28) {
    if (!Number.isFinite(t)) return null;
    const k = Math.max(0, Math.min(1, (t - min) / Math.max(max - min, 0.1)));
    let rgb;
    if (k < 0.5) rgb = mix(COOL, MID, k / 0.5);
    else if (k < 0.85) rgb = mix(MID, WARM, (k - 0.5) / 0.35);
    else rgb = mix(WARM, HOT, (k - 0.85) / 0.15);
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function isTempSensor(hass, id) {
    const st = hass.states[id];
    if (!st || !id.startsWith('sensor.')) return false;
    const a = st.attributes || {};
    return a.device_class === 'temperature' || /°/.test(a.unit_of_measurement || '');
}

/** A sensor with a numeric reading right now (unavailable/unknown never wins over a live one). */
function live(hass, id) {
    return !!id && !!hass.states[id] && Number.isFinite(Number(hass.states[id].state));
}

/** Badge position as [x%, y%] whichever way it is stored. */
function badgePercent(sc) {
    const p = sc.position;
    if (Array.isArray(p)) return p;
    if (p && typeof p === 'object') return p.horizontal || p.vertical || null;
    return null;
}

/** The entity id that gives this room its temperature, or null. */
export function roomTemperatureEntity(host, hass, room) {
    if (!hass || !hass.states) return null;
    if (room.temperature_entity && hass.states[room.temperature_entity]) return room.temperature_entity;
    // A sensor badge parented to the room, or simply placed inside its polygon.
    const badges = (host.shortcuts || []).filter(sc => sc.type === 'sensor' && sc.config && live(hass, sc.config.temperature_entity));
    const inside = (sc) => sc.parent === room.id || (Array.isArray(room.polygon) && badgePercent(sc) && MapGeometry.isPointInPolygon(badgePercent(sc), room.polygon));
    const badge = badges.find(sc => sc.parent === room.id) || badges.find(inside);
    if (badge) return badge.config.temperature_entity;
    if (room.area_id && hass.entities) {
        const devices = hass.devices || {};
        let fallback = null;
        for (const [id, ent] of Object.entries(hass.entities)) {
            const area = ent.area_id || (ent.device_id && devices[ent.device_id] ? devices[ent.device_id].area_id : null);
            if (area !== room.area_id || ent.hidden || !isTempSensor(hass, id)) continue;
            if (live(hass, id)) return id;
            fallback = fallback || id;
        }
        return fallback;
    }
    return null;
}

/** Current temperature of a room, or null. */
export function roomTemperature(host, hass, room) {
    const id = roomTemperatureEntity(host, hass, room);
    if (!id) return null;
    const v = Number(hass.states[id].state);
    return Number.isFinite(v) ? v : null;
}

/** Colour for a room under the card's config, or null when the feature is off / no reading. */
export function roomTint(host, hass, room) {
    if (!host.config || !host.config.room_temperature) return null;
    const range = Array.isArray(host.config.temperature_range) && host.config.temperature_range.length === 2 ? host.config.temperature_range : [16, 28];
    return tempColor(roomTemperature(host, hass, room), range[0], range[1]);
}

/** Signature of all room tints, to restyle only when a reading changed. */
export function tintSignature(host, hass) {
    if (!host.config || !host.config.room_temperature) return '';
    return (host.rooms || []).map(r => roomTint(host, hass, r) || '-').join('|');
}

/**
 * Which entities belong to a room's HA area, and how each one is shown
 * and controlled. Pure functions over the frontend `hass` object
 * (`hass.entities`, `hass.devices`, `hass.states`).
 */

const CONTROL_DOMAINS = ['light', 'switch', 'fan', 'input_boolean', 'cover', 'lock', 'climate', 'media_player', 'vacuum'];
const SENSOR_CLASSES = ['temperature', 'humidity', 'illuminance', 'power', 'energy', 'battery', 'co2', 'pm25', 'moisture'];
const BINARY_CLASSES = ['motion', 'occupancy', 'presence', 'door', 'window', 'opening', 'garage_door', 'moisture', 'smoke'];
const ORDER = { light: 0, switch: 1, fan: 2, input_boolean: 3, cover: 4, lock: 5, climate: 6, media_player: 7, vacuum: 8, binary_sensor: 9, sensor: 10 };

/** Entity ids in an area (directly or through their device), user-facing only. */
export function areaEntities(hass, areaId) {
    if (!hass || !areaId || !hass.entities) return [];
    const devices = hass.devices || {};
    const out = [];
    for (const [id, ent] of Object.entries(hass.entities)) {
        if (ent.hidden || ent.disabled_by || ent.entity_category) continue;
        const area = ent.area_id || (ent.device_id && devices[ent.device_id] ? devices[ent.device_id].area_id : null);
        if (area !== areaId) continue;
        if (!hass.states || !hass.states[id]) continue;
        if (!isInteresting(id, hass.states[id])) continue;
        out.push(id);
    }
    return out.sort((a, b) => (ORDER[a.split('.')[0]] ?? 99) - (ORDER[b.split('.')[0]] ?? 99) || a.localeCompare(b));
}

export function isInteresting(id, st) {
    const domain = id.split('.')[0];
    if (CONTROL_DOMAINS.includes(domain)) return true;
    const cls = st.attributes && st.attributes.device_class;
    if (domain === 'sensor') return SENSOR_CLASSES.includes(cls) || !!(st.attributes && st.attributes.unit_of_measurement);
    if (domain === 'binary_sensor') return BINARY_CLASSES.includes(cls);
    return false;
}

const ICONS = {
    light: '💡', switch: '🔌', fan: '🌀', input_boolean: '🔘', cover: '🪟', lock: '🔒', climate: '🌡️', media_player: '🎵', vacuum: '🤖',
    temperature: '🌡️', humidity: '💧', illuminance: '☀️', power: '⚡', energy: '⚡', battery: '🔋', co2: '🫧', pm25: '🌫️', moisture: '💧',
    motion: '🚶', occupancy: '🚶', presence: '🚶', door: '🚪', window: '🪟', opening: '🚪', garage_door: '🚗', smoke: '🔥'
};

/** Display model for one entity: { id, name, icon, value, kind, on }. */
export function describeEntity(hass, id) {
    const d = describeLive(hass, id);
    const s = hass.states[id].state;
    d.unavailable = s === 'unavailable' || s === 'unknown';
    if (d.unavailable) { d.value = s === 'unknown' ? 'Unknown' : 'Unavailable'; d.on = false; }
    return d;
}

function describeLive(hass, id) {
    const st = hass.states[id];
    const domain = id.split('.')[0];
    const a = st.attributes || {};
    const cls = a.device_class;
    const name = a.friendly_name || id;
    const icon = ICONS[cls] || ICONS[domain] || '•';
    const s = st.state;
    if (['light', 'switch', 'fan', 'input_boolean'].includes(domain)) return { id, name, icon, kind: 'toggle', on: s === 'on', value: s === 'on' ? 'On' : 'Off' };
    if (domain === 'cover') return { id, name, icon, kind: 'cover', value: s, on: s === 'open' || s === 'opening' };
    if (domain === 'lock') return { id, name, icon, kind: 'lock', value: s, on: s === 'unlocked' };
    if (domain === 'climate') return { id, name, icon, kind: 'climate', value: a.temperature !== undefined ? `${a.temperature}°` : s, current: a.current_temperature, on: s !== 'off', target: a.temperature, step: a.target_temp_step || 0.5 };
    if (domain === 'media_player') return { id, name, icon, kind: 'media', value: s === 'playing' ? (a.media_title || 'Playing') : s, on: s === 'playing' };
    if (domain === 'vacuum') return { id, name, icon, kind: 'vacuum', value: s, on: s === 'cleaning' };
    if (domain === 'binary_sensor') return { id, name, icon, kind: 'binary', value: s === 'on' ? (BINARY_ON[cls] || 'On') : (BINARY_OFF[cls] || 'Off'), on: s === 'on' };
    const num = Number(s);
    const value = Number.isFinite(num) ? `${Math.round(num * 10) / 10}${a.unit_of_measurement ? (a.unit_of_measurement.startsWith('°') ? '' : ' ') + a.unit_of_measurement : ''}` : s;
    return { id, name, icon, kind: 'value', value, on: false };
}

const BINARY_ON = { motion: 'Motion', occupancy: 'Occupied', presence: 'Home', door: 'Open', window: 'Open', opening: 'Open', garage_door: 'Open', moisture: 'Wet', smoke: 'Smoke!' };
const BINARY_OFF = { motion: 'Clear', occupancy: 'Empty', presence: 'Away', door: 'Closed', window: 'Closed', opening: 'Closed', garage_door: 'Closed', moisture: 'Dry', smoke: 'Clear' };

/** Service call for a control gesture: { domain, service, data } or null. */
export function controlCall(desc, action = 'primary') {
    const domain = desc.id.split('.')[0];
    const data = { entity_id: desc.id };
    switch (desc.kind) {
        case 'toggle': return { domain, service: 'toggle', data };
        case 'cover': return { domain: 'cover', service: action === 'secondary' ? 'close_cover' : (desc.on ? 'close_cover' : 'open_cover'), data };
        case 'lock': return { domain: 'lock', service: desc.on ? 'lock' : 'unlock', data };
        case 'media': return { domain: 'media_player', service: 'media_play_pause', data };
        case 'vacuum': return { domain: 'vacuum', service: desc.on ? 'return_to_base' : 'start', data };
        case 'climate': {
            if (action === 'up' || action === 'down') {
                const t = (desc.target ?? 20) + (action === 'up' ? desc.step : -desc.step);
                return { domain: 'climate', service: 'set_temperature', data: { ...data, temperature: Math.round(t * 10) / 10 } };
            }
            return null;
        }
        default: return null;
    }
}

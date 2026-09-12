/**
 * Finding a robot's helper entities.
 *
 * Entity ids are not stable: people rename them, and integrations retire
 * them (Roborock's "mop drying" binary sensor became a switch). So look the
 * robot's entities up in the entity registry by their translation key,
 * across both the robot device and its dock, and only fall back to guessing
 * `<domain>.<robot slug>_<suffix>` when no registry is available.
 */

const name = (d) => d.name_by_user || d.name || '';
const under = (child, parent) => !!child && !!parent && child !== parent && child.startsWith(`${parent} `);
const entries = (d) => d.config_entries || (d.primary_config_entry ? [d.primary_config_entry] : []);
const sameEntry = (a, b) => entries(a).some(e => entries(b).includes(e));

/** The robot's own device plus the devices hanging off it (its dock). */
export function vacuumDevices(hass, vacuumId) {
    const ent = hass && hass.entities ? hass.entities[vacuumId] : null;
    const root = ent ? ent.device_id : null;
    const devices = hass && hass.devices ? hass.devices : null;
    if (!root) return [];
    const dev = devices ? devices[root] : null;
    if (!dev) return [root];
    const ids = [root];
    Object.keys(devices).forEach(id => {
        const d = devices[id];
        if (!d || id === root) return;
        const linked = d.via_device_id === root || d.parent_device_id === root;
        const named = sameEntry(d, dev) && (under(d.model, dev.model) || under(name(d), name(dev)));
        if (linked || named) ids.push(id);
    });
    return ids;
}

/**
 * An index of one robot's entities: `find(domain, key, idSuffix)` returns a
 * live entity id, `binarySensors()` lists its binary sensors.
 */
export function vacuumIndex(hass, vacuumId) {
    const states = (hass && hass.states) || {};
    const slug = String(vacuumId).split('.')[1] || '';
    const devices = new Set(vacuumDevices(hass, vacuumId));
    const byKey = new Map();
    const owned = [];
    Object.keys((hass && hass.entities) || {}).forEach(id => {
        const e = hass.entities[id];
        if (!e || !devices.has(e.device_id)) return;
        owned.push(id);
        if (!e.translation_key) return;
        const k = `${id.split('.')[0]}:${e.translation_key}`;
        if (!byKey.has(k)) byKey.set(k, id);
    });
    const live = (id) => (id && states[id] ? id : null);
    const find = (domain, key, idSuffix) => live(byKey.get(`${domain}:${key}`)) || live(`${domain}.${slug}_${idSuffix || key}`);
    const binarySensors = () => {
        const fromRegistry = owned.filter(id => id.startsWith('binary_sensor.') && states[id]);
        if (fromRegistry.length) return fromRegistry;
        return Object.keys(states).filter(id => id.startsWith(`binary_sensor.${slug}_`));
    };
    return { find, binarySensors, slug, devices: [...devices], owned };
}

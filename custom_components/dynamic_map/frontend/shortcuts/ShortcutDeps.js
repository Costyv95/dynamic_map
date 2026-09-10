/**
 * Which entities a shortcut reads. The card uses this to skip re-rendering
 * a badge on hass ticks that did not touch any of its entities.
 */

const ENTITY_KEYS = [
    'entity', 'state_entity', 'display_entity', 'temperature_entity',
    'humidity_entity', 'availability_entity', 'action_entity'
];
const TEMPLATE_RE = /states\(\s*['"]([^'"]+)['"]\s*\)/g;

function addTemplateEntities(str, out) {
    if (typeof str !== 'string') return;
    let m;
    TEMPLATE_RE.lastIndex = 0;
    while ((m = TEMPLATE_RE.exec(str)) !== null) out.add(m[1]);
}

function walk(node, out, depth) {
    if (!node || typeof node !== 'object' || depth > 8) return;
    if (Array.isArray(node)) {
        node.forEach(n => walk(n, out, depth + 1));
        return;
    }
    for (const key of Object.keys(node)) {
        const val = node[key];
        if (ENTITY_KEYS.includes(key) && typeof val === 'string' && val.includes('.')) out.add(val);
        else if (typeof val === 'string') addTemplateEntities(val, out);
        else if (val && typeof val === 'object') walk(val, out, depth + 1);
    }
}

/** Sorted, de-duplicated entity ids a shortcut depends on. */
export function collectEntities(sc) {
    const out = new Set();
    if (sc.entity_id) out.add(sc.entity_id);
    walk(sc.config || {}, out, 0);
    return [...out].sort();
}

/**
 * Snapshot the state objects of the given entities. HA replaces the state
 * object when an entity changes, so identity comparison is enough.
 */
export function snapshotStates(entities, hass) {
    const snap = {};
    const states = hass && hass.states ? hass.states : {};
    entities.forEach(id => { snap[id] = states[id]; });
    return snap;
}

/** True when any tracked entity's state object differs from the snapshot. */
export function statesChanged(entities, snap, hass) {
    if (!snap) return true;
    const states = hass && hass.states ? hass.states : {};
    return entities.some(id => states[id] !== snap[id]);
}

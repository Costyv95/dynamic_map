/**
 * Generic progress-bar model for a shortcut's PROGRESS_BAR action.
 *
 * Pure computation only (no DOM), so the fill/colour/label rules are testable
 * and shared by every consumer. card/OverlayManager.js renders the result.
 *
 * It is deliberately NOT vacuum-specific: anything with a number and a range
 * can be a bar (consumable life left, battery, tank level, disk usage, a
 * percentage attribute of a light, ...).
 *
 * Config (an entry in a shortcut's config.actions):
 *   type: "PROGRESS_BAR"
 *   action_entity: entity to read (defaults to the shortcut's entity)
 *   attribute:     read this attribute instead of the state
 *   name:          caption ("" hides it, omitted = the entity's friendly name)
 *   unit:          unit override (default: the entity's unit_of_measurement)
 *   decimals:      rounding for the printed value
 *   min / max:     range for the fill (default 0 / 100). `max` may also be the
 *                  name of another entity or "attribute:<name>" so a bar can
 *                  scale against a live maximum.
 *   invert:        true = a FULL bar is bad (e.g. disk usage) -- only affects
 *                  which end the default thresholds treat as healthy
 *   color:         fixed fill colour (wins over thresholds)
 *   thresholds:    [{ pct: 0, color: "#ef4444" }, ...] or [{ value: 50, ... }]
 *                  -- the last entry whose pct/value is <= the reading wins
 *   show_value:    false hides the numeric readout
 *   service/payload + confirm: see OverlayManager (an optional tap action)
 */

/** Default palette: red below 10%, amber below 25%, otherwise green. */
export const DEFAULT_THRESHOLDS = [
    { pct: 0, color: '#ef4444' },
    { pct: 10, color: '#f59e0b' },
    { pct: 25, color: '#10b981' },
];

/** Same palette mirrored, for bars where a FULL bar is the bad end. */
export const DEFAULT_THRESHOLDS_INVERTED = [
    { pct: 0, color: '#10b981' },
    { pct: 75, color: '#f59e0b' },
    { pct: 90, color: '#ef4444' },
];

const UNAVAILABLE = ['unknown', 'unavailable', 'none', '', null, undefined];

/**
 * Resolve a bound that may be a literal number, an entity id, or
 * "attribute:<name>" (read off the bar's own entity).
 */
function resolveBound(bound, hass, target, fallback) {
    if (bound === undefined || bound === null || bound === '') return fallback;
    const asNum = parseFloat(bound);
    if (!isNaN(asNum) && String(bound).trim() === String(asNum)) return asNum;
    if (!hass || !hass.states) return fallback;

    if (typeof bound === 'string' && bound.startsWith('attribute:')) {
        const st = hass.states[target];
        const v = st ? parseFloat(st.attributes[bound.slice('attribute:'.length)]) : NaN;
        return isNaN(v) ? fallback : v;
    }
    const st = hass.states[bound];
    if (!st) return fallback;
    const v = parseFloat(st.state);
    return isNaN(v) ? fallback : v;
}

/** Pick the colour for a reading from a threshold list (last match wins). */
export function pickColor(thresholds, pct, value) {
    let color = null;
    for (const t of thresholds || []) {
        if (!t || !t.color) continue;
        if (t.pct !== undefined) {
            if (pct >= t.pct) color = t.color;
        } else if (t.value !== undefined) {
            if (value !== null && value >= t.value) color = t.color;
        }
    }
    return color;
}

/**
 * Compute everything needed to draw one bar.
 *
 * @returns {{available:boolean, value:number|null, min:number, max:number,
 *            pct:number, valueStr:string, color:string, label:string,
 *            unit:string}}
 *          `pct` is always the 0-100 FILL fraction; `available` is false when
 *          the entity is missing or non-numeric (bar renders empty, "--").
 */
export function computeProgressBar({ act = {}, hass = null, target = null } = {}) {
    const entity = act.action_entity || target;
    const st = hass && hass.states ? hass.states[entity] : null;

    const raw = st ? (act.attribute ? st.attributes[act.attribute] : st.state) : null;
    const num = parseFloat(raw);
    const available = Boolean(st) && !UNAVAILABLE.includes(raw) && !isNaN(num);
    const value = available ? num : null;

    const min = resolveBound(act.min, hass, entity, 0);
    let max = resolveBound(act.max, hass, entity, 100);
    if (max === min) max = min + 1; // never divide by zero

    let pct = 0;
    if (available) {
        pct = ((value - min) / (max - min)) * 100;
        pct = Math.max(0, Math.min(100, pct));
    }

    let unit = act.unit;
    if (unit === undefined) unit = (st && !act.attribute) ? (st.attributes.unit_of_measurement || '') : '';

    let valueStr = '--';
    if (available) {
        const dec = act.decimals !== undefined ? act.decimals : (Number.isInteger(value) ? 0 : 1);
        valueStr = `${value.toFixed(dec)}${unit ? ' ' + unit : ''}`;
    }

    // `invert` flips which end counts as healthy for the DEFAULT palette; an
    // explicit thresholds list is always read as given.
    let thresholds = act.thresholds;
    if (!thresholds || !thresholds.length) {
        thresholds = act.invert ? DEFAULT_THRESHOLDS_INVERTED : DEFAULT_THRESHOLDS;
    }

    let color = act.color || pickColor(thresholds, pct, value) || '#10b981';
    if (!available) color = 'rgba(255,255,255,0.25)';

    let label = act.name;
    if (label === undefined) label = st ? (st.attributes.friendly_name || entity || '') : (entity || '');

    return { available, value, min, max, pct, valueStr, color, label, unit };
}

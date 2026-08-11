import { evaluateTemplate } from '../shortcuts/TemplateEvaluator.js?v=3.2.1';

/**
 * Rough per-character width factors (in em) for bold Roboto-ish text.
 * SVG text can't be measured before it is mounted, so the pill is sized
 * from this estimate; the value text is start-anchored, so a slightly-off
 * estimate only affects right padding, never overlap.
 */
export function estimateTextWidth(text, fontSize) {
    let em = 0;
    for (const ch of String(text)) {
        const code = ch.codePointAt(0);
        if (ch === '.' || ch === ',' || ch === ':' || ch === "'") em += 0.30;
        else if (ch === ' ') em += 0.32;
        else if (ch === '-') em += 0.40;
        else if (ch === '°') em += 0.42;
        else if (ch === '%') em += 0.95;
        else if (code > 0x2100) em += 1.15; // emoji & pictographs
        else if (ch >= '0' && ch <= '9') em += 0.60;
        else if (ch >= 'A' && ch <= 'Z') em += 0.72;
        else em += 0.58;
    }
    return em * fontSize;
}

/**
 * Single source of truth for the sensor pill shown on the map.
 *
 * Resolves display content (icon, value template, colors) with
 * state > config > default precedence, then computes an auto-sized flow
 * layout relative to the pill center: [pad | icon | gap | value | pad].
 * The icon is center-anchored inside its slot and the value text is
 * start-anchored right after it, so the two can never overlap regardless
 * of how long the value renders.
 *
 * Consumed by both the dashboard card (MapShortcut → SVG) and the editor
 * preview (CanvasEngine → canvas). `measure(text, fontSize)` may be
 * overridden with an exact measurer where one is available.
 */
export function computeSensorPill({ sc, state = null, hass = null, scaleX = 1, scaleY = 1, measure = estimateTextWidth, displayOverride = null }) {
    const cfg = sc.config || {};
    const minS = Math.min(scaleX, scaleY);

    const color = (state && state.color) || cfg.color || '#10b981';
    const transparent = (state && state.transparent !== undefined) ? !!state.transparent : !!cfg.transparent;
    const fg = transparent ? color : '#ffffff';
    let icon = (state && state.icon) || cfg.icon || '🌡️';

    let dispEntity = (state && (state.display_entity || state.state_entity))
        || cfg.temperature_entity || cfg.state_entity || sc.entity_id;
    if (!dispEntity && state && state.conditions) {
        const cond = state.conditions.find(c => c.entity || c.state_entity);
        if (cond) dispEntity = cond.entity || cond.state_entity;
    }
    let unit = (state && state.unit !== undefined) ? state.unit : (cfg.unit !== undefined ? cfg.unit : '°');
    let template = (state && state.value_template) || cfg.value_template || '';
    if (displayOverride && displayOverride.entity) {
        // Runtime display cycle (tap on a sensor pill): beats state/config
        // templates so the tap visibly changes what the pill shows.
        dispEntity = displayOverride.entity;
        if (displayOverride.unit !== undefined) unit = displayOverride.unit;
        if (displayOverride.icon) icon = displayOverride.icon;
        template = '';
    }
    if (!template) template = dispEntity ? `{states('${dispEntity}')}${unit}` : '';
    const value = evaluateTemplate(template, hass);

    const fontIcon = 14 * minS;
    const fontValue = 12 * minS;
    const height = 24 * scaleY;
    const pad = 6 * scaleX;
    const gap = 3 * minS;
    const iconW = fontIcon * 1.1;
    const textW = measure(value, fontValue);
    const width = Math.max(pad + iconW + gap + textW + pad, height);
    const left = -width / 2;

    const round = (v) => Math.round(v * 100) / 100;
    return {
        icon,
        value,
        color,
        transparent,
        fg,
        width: round(width),
        height: round(height),
        rx: round(8 * minS),
        fontIcon: round(fontIcon),
        fontValue: round(fontValue),
        iconX: round(left + pad + iconW / 2), // center-anchored icon slot
        textX: round(left + pad + iconW + gap) // start-anchored value text
    };
}

/**
 * Small colour helpers shared by the card and the editor.
 */

/** '#rgb', '#rrggbb', 'rgb(r, g, b)', 'rgb(r g b)' or 'rgba(…)' -> [r, g, b] (0-255), else null.
 * The one colour parser of the card and the editor (#1708). */
export function parseColor(value) {
    const s = String(value || '').trim().toLowerCase();
    let m = s.match(/^#([0-9a-f]{3})$/);
    if (m) return [...m[1]].map(c => parseInt(c + c, 16));
    m = s.match(/^#([0-9a-f]{6})$/);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    return null;
}

/** Rotate an rgb()/#hex colour's hue by deg, returning an rgb() string. */
export function shiftHue(color, deg) {
    const rgb = parseColor(color);
    if (!rgb) return color;
    const [r, g, b] = rgb.map(v => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    h = (h + deg / 360 + 1) % 1;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t) => {
        t = (t + 1) % 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    const to255 = (v) => Math.round(v * 255);
    return `rgb(${to255(hue2rgb(h + 1 / 3))}, ${to255(hue2rgb(h))}, ${to255(hue2rgb(h - 1 / 3))})`;
}

/**
 * Readable text colour for a background: dark slate on light backgrounds,
 * white otherwise. Unknown colour formats keep white.
 */
export function contrastText(color) {
    const rgb = parseColor(color);
    if (!rgb) return '#ffffff';
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return lum > 186 ? '#1e293b' : '#ffffff';
}

/**
 * Resolve a configured colour. The sentinel 'entity' becomes the bound
 * entity's live rgb_color (amber when the entity reports none).
 */
export function resolveEntityColor(color, hass, entityId) {
    if (color !== 'entity') return color;
    const st = entityId && hass && hass.states ? hass.states[entityId] : null;
    const rgb = st && st.attributes ? st.attributes.rgb_color : null;
    if (Array.isArray(rgb) && rgb.length >= 3) {
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
    return '#f59e0b';
}

/** True for a fully transparent rgba() or empty/none fill. */
export function isTransparentFill(fill) {
    return !fill || fill === 'none' || /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(fill);
}

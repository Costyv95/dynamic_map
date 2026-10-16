import { KINDS } from './FurnitureKinds.js?v=3.2.1';

/**
 * Parametric furniture, doors and windows: drawn from a kind and a size,
 * so a sofa of any length still reads as a sofa. A decor object picks one
 * with `config.furniture` (and optional `config.furniture_opts`); the card,
 * the editor and Portal all draw it through this one module.
 *
 * Every kind draws into a local box of w × h map units centred on 0,0, its
 * "front" facing down (+y): a sofa's back, a bed's headboard and a toilet's
 * tank are at the top, so rotation alone places them against any wall.
 *
 * Doors: the box is the swing. The opening lies along the bottom edge (the
 * wall face), the hinge at its left end; `mirror` moves the hinge right.
 * `cut` (map units) paints the wall under the opening away, so a door can
 * be dropped onto an unbroken wall. Windows: the box is the opening in the
 * wall (h = the wall's thickness).
 *
 * Colours come in as `colors` { fill, line, soft, floor } (already toned by
 * the caller); greys only, so the floor tone maps them like the walls.
 */

export const FURNITURE_COLORS = { fill: '#ffffff', line: '#64748b', soft: '#e2e8f0', floor: '#eeeeee' };

/** Kinds for the editor's picker: [{ value, label, size: [w, h] }]. */
export function furnitureKinds() {
    return Object.values(KINDS).map(k => ({ value: k.kind, label: k.label, size: k.size }));
}

export function isFurnitureKind(kind) { return !!KINDS[kind]; }

const n = (v) => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Small element builder bound to one group. */
function painter(svgNS, group, c, sw) {
    const add = (tag, attrs) => {
        const el = document.createElementNS(svgNS, tag);
        for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, typeof v === 'number' ? n(v) : v);
        group.appendChild(el);
        return el;
    };
    const style = (o = {}) => ({
        fill: o.fill === undefined ? c.fill : o.fill,
        stroke: o.stroke === undefined ? c.line : o.stroke,
        'stroke-width': o.sw === undefined ? sw : o.sw,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': o.dash
    });
    return {
        n,
        rect: (x, y, w, h, o = {}) => add('rect', { x, y, width: Math.max(0, w), height: Math.max(0, h), rx: o.r || 0, ry: o.r || 0, ...style(o) }),
        circle: (cx, cy, r, o = {}) => add('circle', { cx, cy, r: Math.max(0, r), ...style(o) }),
        ellipse: (cx, cy, rx, ry, o = {}) => add('ellipse', { cx, cy, rx: Math.max(0, rx), ry: Math.max(0, ry), ...style(o) }),
        line: (x1, y1, x2, y2, o = {}) => add('line', { x1, y1, x2, y2, ...style({ fill: 'none', ...o }) }),
        path: (d, o = {}) => add('path', { d, ...style(o) })
    };
}

/**
 * One furniture group: { kind, width, height, colors, opts, x, y }.
 * Unknown kinds draw a plain labelled box so a typo is visible, not blank.
 */
export function drawFurniture(svgNS, { kind, width = 24, height = 24, colors = FURNITURE_COLORS, opts = {}, x = 0, y = 0 }) {
    const group = document.createElementNS(svgNS, 'g');
    group.classList.add('dm-furniture');
    group.dataset.kind = kind || '';
    const c = { ...FURNITURE_COLORS, ...(colors || {}) };
    const w = Math.max(1, Number(width) || 24), h = Math.max(1, Number(height) || 24);
    const sw = clamp(Math.min(w, h) * 0.04, 1, 2.2);
    const p = painter(svgNS, group, c, sw);
    p.thin = Math.max(0.8, sw * 0.6);
    const o = opts || {};
    const k = KINDS[kind];
    if (k) k.draw(p, w, h, c, o);
    else p.rect(-w / 2, -h / 2, w, h, { dash: '4 3' });
    const t = [];
    if (x || y) t.push(`translate(${n(x)} ${n(y)})`);
    if (o.mirror) t.push('scale(-1 1)');
    if (t.length) group.setAttribute('transform', t.join(' '));
    return group;
}

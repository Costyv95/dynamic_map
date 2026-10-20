/**
 * The furniture catalogue for shared/Furniture.js: each kind draws into a
 * local w × h box centred on 0,0, back at the top (-y), front facing +y.
 * `p` is the painter (rect, circle, ellipse, line, path, n, thin), `c` the
 * toned colours, `o` the kind's options (config.furniture_opts).
 */

export const KINDS = {};
const def = (kind, label, size, draw) => { KINDS[kind] = { kind, label, size, draw }; };
const n = (v) => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// --- seating -------------------------------------------------------------

function drawSofa(p, w, h, c, o, seats) {
    const back = h * 0.26, arm = clamp(h * 0.22, 4, w * 0.18);
    const r = Math.min(w, h) * 0.12;
    p.rect(-w / 2, -h / 2, w, h, { r });
    p.rect(-w / 2 + arm, -h / 2 + back, w - 2 * arm, h - back, { r: r * 0.5, fill: c.soft });
    const count = seats || clamp(Math.round((w - 2 * arm) / (h * 0.95)), 1, 5);
    const sw = (w - 2 * arm) / count;
    for (let i = 1; i < count; i++) {
        const x = -w / 2 + arm + i * sw;
        p.line(x, -h / 2 + back, x, h / 2);
    }
}
def('sofa', 'Sofa', [200, 90], (p, w, h, c, o) => drawSofa(p, w, h, c, o, o.seats));
def('armchair', 'Armchair', [80, 80], (p, w, h, c, o) => drawSofa(p, w, h, c, o, 1));

function drawChair(p, cx, cy, w, h, c, rot = 0) {
    // A seat with a curved back toward -y, rotated about its centre.
    const g = rot ? ` rotate(${rot} ${n(cx)} ${n(cy)})` : '';
    const seat = p.rect(cx - w / 2, cy - h / 2 + h * 0.18, w, h * 0.82, { r: Math.min(w, h) * 0.25 });
    const back = p.path(`M ${n(cx - w / 2)} ${n(cy - h / 2 + h * 0.2)} Q ${n(cx)} ${n(cy - h / 2 - h * 0.08)} ${n(cx + w / 2)} ${n(cy - h / 2 + h * 0.2)}`, { fill: 'none' });
    if (g) { seat.setAttribute('transform', g.trim()); back.setAttribute('transform', g.trim()); }
}
def('chair', 'Chair', [45, 45], (p, w, h, c) => drawChair(p, 0, 0, w, h, c));
def('office_chair', 'Office chair', [60, 60], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2 + h * 0.15, w, h * 0.7, { r: Math.min(w, h) * 0.3 });
    p.rect(-w * 0.4, -h / 2, w * 0.8, h * 0.2, { r: h * 0.08, fill: c.soft });
    p.line(-w / 2, -h / 2 + h * 0.3, -w / 2, h / 2 - h * 0.2);
    p.line(w / 2, -h / 2 + h * 0.3, w / 2, h / 2 - h * 0.2);
});

// --- tables --------------------------------------------------------------

def('table', 'Table', [120, 80], (p, w, h, c, o) => {
    if (o.round) p.ellipse(0, 0, w / 2, h / 2);
    else p.rect(-w / 2, -h / 2, w, h, { r: Math.min(w, h) * 0.06 });
});

def('dining_table', 'Dining table with chairs', [280, 200], (p, w, h, c, o) => {
    // The box holds table and chairs; chairs tuck halfway under the edge.
    const cs = clamp(Math.min(w, h) * 0.26, 24, 60);
    const tw = w - (o.ends === false ? 0 : cs * 1.2), th = h - cs * 1.2;
    const per = o.per_side || clamp(Math.floor(tw / (cs * 1.5)), 1, 6);
    const gap = tw / per;
    for (let i = 0; i < per; i++) {
        const x = -tw / 2 + gap * (i + 0.5);
        drawChair(p, x, -th / 2 - cs * 0.15, cs, cs, c, 0);
        drawChair(p, x, th / 2 + cs * 0.15, cs, cs, c, 180);
    }
    if (o.ends !== false) {
        drawChair(p, -tw / 2 - cs * 0.15, 0, cs, cs, c, -90);
        drawChair(p, tw / 2 + cs * 0.15, 0, cs, cs, c, 90);
    }
    if (o.round) p.ellipse(0, 0, tw / 2, th / 2);
    else p.rect(-tw / 2, -th / 2, tw, th, { r: Math.min(tw, th) * 0.05 });
});

def('desk', 'Desk', [140, 70], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h, { r: Math.min(w, h) * 0.04 });
});

// --- beds ----------------------------------------------------------------

def('bed', 'Bed', [160, 200], (p, w, h, c, o) => {
    const r = Math.min(w, h) * 0.04;
    p.rect(-w / 2, -h / 2, w, h, { r });
    const head = h * 0.06;
    p.rect(-w / 2, -h / 2, w, head, { r, fill: c.soft });
    const pillows = o.pillows || (w >= h * 0.6 ? 2 : 1);
    const pw = (w - w * 0.08 * (pillows + 1)) / pillows, ph = h * 0.14;
    for (let i = 0; i < pillows; i++) {
        p.rect(-w / 2 + w * 0.08 + i * (pw + w * 0.08), -h / 2 + head + h * 0.03, pw, ph, { r: ph * 0.35 });
    }
    // Duvet, folded back.
    const top = -h / 2 + head + h * 0.22;
    p.path(`M ${n(-w / 2)} ${n(top)} L ${n(w / 2)} ${n(top)} L ${n(w / 2)} ${n(h / 2)} L ${n(-w / 2)} ${n(h / 2)} Z`, { fill: c.fill });
    p.line(-w / 2, top + h * 0.08, w / 2, top + h * 0.08);
});

// --- storage -------------------------------------------------------------

def('cabinet', 'Cabinet', [100, 50], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h);
    p.line(-w / 2 + Math.min(w, h) * 0.12, h / 2 - Math.min(w, h) * 0.12, w / 2 - Math.min(w, h) * 0.12, h / 2 - Math.min(w, h) * 0.12);
});

def('wardrobe', 'Wardrobe', [180, 60], (p, w, h, c, o) => {
    p.rect(-w / 2, -h / 2, w, h);
    const doors = o.doors || clamp(Math.round(w / 55), 1, 6);
    for (let i = 1; i < doors; i++) p.line(-w / 2 + (w / doors) * i, -h / 2, -w / 2 + (w / doors) * i, h / 2);
    // Hanging rail.
    p.line(-w / 2 + h * 0.15, 0, w / 2 - h * 0.15, 0, { dash: `${n(h * 0.12)} ${n(h * 0.1)}` });
});

def('shelf', 'Shelf', [100, 35], (p, w, h, c, o) => {
    p.rect(-w / 2, -h / 2, w, h);
    const bays = o.bays || clamp(Math.round(w / 45), 1, 8);
    for (let i = 1; i < bays; i++) p.line(-w / 2 + (w / bays) * i, -h / 2, -w / 2 + (w / bays) * i, h / 2);
});

def('counter', 'Kitchen counter', [180, 60], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h);
    p.line(-w / 2, h / 2 - h * 0.12, w / 2, h / 2 - h * 0.12);
});

def('tv_unit', 'TV unit', [160, 45], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h);
    // The screen, edge-on, along the back.
    p.rect(-w * 0.4, -h / 2 + h * 0.1, w * 0.8, h * 0.14, { r: h * 0.05, fill: c.line, stroke: 'none' });
});

// --- kitchen -------------------------------------------------------------

def('fridge', 'Fridge', [65, 65], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h);
    p.line(-w / 2, h / 2 - h * 0.1, w / 2, h / 2 - h * 0.1);
    const s = Math.min(w, h) * 0.2;
    for (let a = 0; a < 3; a++) {
        const t = (a * Math.PI) / 3;
        p.line(-Math.cos(t) * s, -Math.sin(t) * s, Math.cos(t) * s, Math.sin(t) * s);
    }
});

def('hob', 'Hob / oven', [65, 60], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h);
    const r = Math.min(w, h) * 0.15;
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.circle(x * w * 0.22, y * h * 0.22, r, { fill: 'none' });
});

def('sink', 'Kitchen sink', [80, 55], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h);
    p.rect(-w / 2 + w * 0.12, -h / 2 + h * 0.25, w * 0.76, h * 0.6, { r: Math.min(w, h) * 0.1, fill: c.soft });
    p.circle(0, -h / 2 + h * 0.13, Math.min(w, h) * 0.06, { fill: c.line, stroke: 'none' });
});

// --- bathroom ------------------------------------------------------------

def('washbasin', 'Washbasin', [60, 45], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h, { r: Math.min(w, h) * 0.08 });
    p.ellipse(0, h * 0.08, w * 0.34, h * 0.3, { fill: c.soft });
    p.circle(0, -h / 2 + h * 0.14, Math.min(w, h) * 0.07, { fill: c.line, stroke: 'none' });
});

def('toilet', 'Toilet', [40, 65], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h * 0.26, { r: h * 0.05 });
    p.ellipse(0, h * 0.14, w * 0.42, h * 0.34);
    p.ellipse(0, h * 0.17, w * 0.27, h * 0.22, { fill: c.soft });
});

def('bathtub', 'Bathtub', [170, 75], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h, { r: Math.min(w, h) * 0.08 });
    const m = Math.min(w, h) * 0.1;
    p.rect(-w / 2 + m, -h / 2 + m, w - 2 * m, h - 2 * m, { r: Math.min(w, h) * 0.32, fill: c.soft });
    p.circle(w / 2 - m - Math.min(w, h) * 0.12, 0, Math.min(w, h) * 0.05, { fill: 'none' });
});

def('shower', 'Shower', [90, 90], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h, { fill: c.soft });
    p.line(-w / 2, -h / 2, w / 2, h / 2);
    p.line(w / 2, -h / 2, -w / 2, h / 2);
    p.circle(0, 0, Math.min(w, h) * 0.06, { fill: c.fill });
});

def('washer', 'Washing machine', [60, 60], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h, { r: Math.min(w, h) * 0.06 });
    p.circle(0, h * 0.05, Math.min(w, h) * 0.32, { fill: c.soft });
    p.circle(0, h * 0.05, Math.min(w, h) * 0.2, { fill: 'none' });
});

// --- structure -----------------------------------------------------------

def('stairs', 'Stairs', [250, 100], (p, w, h, c, o) => {
    // Treads run across w; the arrow points up the flight (toward +x).
    p.rect(-w / 2, -h / 2, w, h);
    const steps = o.steps || clamp(Math.round(w / 28), 2, 30);
    for (let i = 1; i < steps; i++) p.line(-w / 2 + (w / steps) * i, -h / 2, -w / 2 + (w / steps) * i, h / 2);
    const dir = o.down ? -1 : 1;
    const a = Math.min(h * 0.18, w * 0.05);
    p.line(-dir * w * 0.42, 0, dir * w * 0.42, 0);
    p.path(`M ${n(dir * w * 0.42 - dir * a)} ${n(-a)} L ${n(dir * w * 0.42)} 0 L ${n(dir * w * 0.42 - dir * a)} ${n(a)}`, { fill: 'none' });
});

def('fireplace', 'Fireplace / stove', [80, 120], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h);
    p.path(`M ${n(-w * 0.38)} ${n(-h * 0.36)} L ${n(w * 0.38)} ${n(-h * 0.36)} L ${n(w * 0.2)} ${n(h * 0.36)} L ${n(-w * 0.2)} ${n(h * 0.36)} Z`, { fill: c.soft });
});

def('radiator', 'Radiator', [100, 15], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h, { r: h * 0.3 });
    const fins = clamp(Math.round(w / 10), 2, 30);
    for (let i = 1; i < fins; i++) p.line(-w / 2 + (w / fins) * i, -h / 2 + h * 0.2, -w / 2 + (w / fins) * i, h / 2 - h * 0.2);
});

def('plant', 'Plant', [45, 45], (p, w, h, c) => {
    p.ellipse(0, 0, w / 2, h / 2, { fill: c.soft });
    for (let a = 0; a < 5; a++) {
        const t = (a / 5) * Math.PI * 2;
        p.line(0, 0, Math.cos(t) * w * 0.36, Math.sin(t) * h * 0.36);
    }
});

def('planter', 'Planter', [150, 50], (p, w, h, c, o) => {
    // A trough of plants along its length; `plants` sets how many.
    p.rect(-w / 2, -h / 2, w, h, { r: Math.min(w, h) * 0.12 });
    const m = Math.min(w, h) * 0.12;
    p.rect(-w / 2 + m, -h / 2 + m, w - 2 * m, h - 2 * m, { r: Math.min(w, h) * 0.08, fill: c.soft });
    const long = w >= h, len = long ? w - 2 * m : h - 2 * m, across = long ? h - 2 * m : w - 2 * m;
    const count = o.plants || clamp(Math.round(len / (across * 1.1)), 1, 12);
    const r = Math.min(across * 0.38, len / count * 0.38);
    for (let i = 0; i < count; i++) {
        const t = -len / 2 + (len / count) * (i + 0.5);
        const [x, y] = long ? [t, 0] : [0, t];
        p.circle(x, y, r, { fill: c.fill });
        for (let a = 0; a < 4; a++) {
            const s = (a / 4) * Math.PI * 2 + Math.PI / 4;
            p.line(x, y, x + Math.cos(s) * r * 0.8, y + Math.sin(s) * r * 0.8, { sw: p.thin });
        }
    }
});

def('grill', 'Barbecue grill', [130, 65], (p, w, h, c, o) => {
    // Side shelves either end, the grate between them.
    const shelf = w * 0.2;
    p.rect(-w / 2, -h / 2 + h * 0.1, w, h * 0.8, { r: Math.min(w, h) * 0.06 });
    p.rect(-w / 2 + shelf, -h / 2, w - 2 * shelf, h, { r: Math.min(w, h) * 0.1, fill: c.soft });
    const bars = o.bars || clamp(Math.round((w - 2 * shelf) / 9), 3, 14);
    const gw = w - 2 * shelf;
    for (let i = 1; i < bars; i++) {
        const x = -gw / 2 + (gw / bars) * i;
        p.line(x, -h / 2 + h * 0.14, x, h / 2 - h * 0.14, { sw: p.thin });
    }
});

def('rug', 'Rug', [200, 140], (p, w, h, c, o) => {
    if (o.round) p.ellipse(0, 0, w / 2, h / 2, { fill: c.soft, stroke: 'none' });
    else p.rect(-w / 2, -h / 2, w, h, { r: Math.min(w, h) * 0.05, fill: c.soft, stroke: 'none' });
});

def('door', 'Door', [90, 90], (p, w, h, c, o) => {
    if (o.cut > 0) p.rect(-w / 2, h / 2 - 0.5, w, o.cut + 1, { fill: c.floor, stroke: 'none' });
    // Hinge bottom-left; the leaf stands open along the left edge.
    const leaf = Math.max(2, Math.min(w, h) * 0.035);
    p.rect(-w / 2, -h / 2, leaf, h, { fill: c.fill });
    p.path(`M ${n(-w / 2 + leaf)} ${n(-h / 2)} A ${n(w - leaf)} ${n(h)} 0 0 1 ${n(w / 2)} ${n(h / 2)}`, { fill: 'none', sw: p.thin });
});

def('double_door', 'Double door', [160, 80], (p, w, h, c, o) => {
    if (o.cut > 0) p.rect(-w / 2, h / 2 - 0.5, w, o.cut + 1, { fill: c.floor, stroke: 'none' });
    const leaf = Math.max(2, Math.min(w, h) * 0.035);
    p.rect(-w / 2, -h / 2, leaf, h, { fill: c.fill });
    p.rect(w / 2 - leaf, -h / 2, leaf, h, { fill: c.fill });
    p.path(`M ${n(-w / 2 + leaf)} ${n(-h / 2)} A ${n(w / 2 - leaf)} ${n(h)} 0 0 1 0 ${n(h / 2)}`, { fill: 'none', sw: p.thin });
    p.path(`M ${n(w / 2 - leaf)} ${n(-h / 2)} A ${n(w / 2 - leaf)} ${n(h)} 0 0 0 0 ${n(h / 2)}`, { fill: 'none', sw: p.thin });
});

def('window', 'Window', [120, 20], (p, w, h, c) => {
    p.rect(-w / 2, -h / 2, w, h, { fill: c.fill });
    p.line(-w / 2, -h * 0.12, w / 2, -h * 0.12, { sw: p.thin });
    p.line(-w / 2, h * 0.12, w / 2, h * 0.12, { sw: p.thin });
});


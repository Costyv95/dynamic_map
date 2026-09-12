/**
 * The 24-hour trend chart of the room panel: a sparkline over a fixed
 * time window, a time axis with round-hour ticks, and a hover/touch
 * readout of the exact time and value under the pointer.
 */
const svgNS = 'http://www.w3.org/2000/svg';
export const CHART_W = 120, CHART_H = 34, PAD = 2;

/** Round-hour tick marks inside [start, end], every `stepH` hours, as { t, frac, label }; plus "now" at the end. */
export function axisTicks(start, end, stepH = 6) {
    const span = end - start;
    const first = new Date(start);
    first.setMinutes(0, 0, 0);
    if (first.getTime() < start) first.setHours(first.getHours() + 1);
    const ticks = [];
    for (let t = first.getTime(); t < end - span * 0.06; t += stepH * 3600 * 1000) {
        ticks.push({ t, frac: (t - start) / span, label: fmtTime(t) });
    }
    ticks.push({ t: end, frac: 1, label: 'now' });
    return ticks;
}

export function fmtTime(t) {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Polyline points over the fixed window [x0, x1]; values scaled to the data range. */
export function windowPoints(pts, x0, x1, w = CHART_W, h = CHART_H) {
    if (pts.length < 2) return '';
    const ys = pts.map(p => p[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sx = x1 > x0 ? (w - 2 * PAD) / (x1 - x0) : 0, sy = y1 > y0 ? (h - 2 * PAD) / (y1 - y0) : 0;
    return pts.map(([x, y]) => `${(PAD + (x - x0) * sx).toFixed(1)},${(h - PAD - (y - y0) * sy).toFixed(1)}`).join(' ');
}

/** The sample nearest in time to `frac` (0..1 across the window). */
export function nearestPoint(pts, frac, x0, x1) {
    const t = x0 + frac * (x1 - x0);
    let best = null;
    for (const p of pts) if (!best || Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    return best;
}

/**
 * Render the chart into `slot`. `onHover(active)` lets the panel pause its
 * re-render while a finger is on the chart.
 */
export function drawTrend(slot, pts, { unit = '°', now = Date.now(), hours = 24, onHover = null } = {}) {
    slot.replaceChildren();
    if (pts.length < 2) { slot.hidden = true; return; }
    slot.hidden = false;
    const x1 = now, x0 = now - hours * 3600 * 1000;
    const vals = pts.map(p => p[1]);
    const min = Math.min(...vals), max = Math.max(...vals);
    const fmt = (v) => `${Math.round(v * 10) / 10}${unit}`;
    const head = document.createElement('div');
    head.className = 'dm-rp-trend-head';
    const lab = document.createElement('span');
    lab.className = 'dm-rp-trend-label';
    const summary = `${hours} h · ${fmt(min)} – ${fmt(max)}`;
    lab.textContent = summary;
    const readout = document.createElement('span');
    readout.className = 'dm-rp-trend-readout';
    head.append(lab, readout);

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${CHART_W} ${CHART_H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const ticks = axisTicks(x0, x1);
    ticks.forEach(tk => {
        const l = document.createElementNS(svgNS, 'line');
        const x = (PAD + tk.frac * (CHART_W - 2 * PAD)).toFixed(1);
        l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', '0'); l.setAttribute('y2', String(CHART_H));
        l.setAttribute('class', 'dm-rp-tick');
        l.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(l);
    });
    const line = document.createElementNS(svgNS, 'polyline');
    line.setAttribute('points', windowPoints(pts, x0, x1));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '1.6');
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(line);
    const cursor = document.createElementNS(svgNS, 'line');
    cursor.setAttribute('class', 'dm-rp-cursor');
    cursor.setAttribute('y1', '0'); cursor.setAttribute('y2', String(CHART_H));
    cursor.setAttribute('vector-effect', 'non-scaling-stroke');
    cursor.style.display = 'none';
    svg.appendChild(cursor);

    const axis = document.createElement('div');
    axis.className = 'dm-rp-axis';
    ticks.forEach((tk, i) => {
        const s = document.createElement('span');
        s.textContent = tk.label;
        s.style.left = `${(tk.frac * 100).toFixed(1)}%`;
        if (i === 0 && tk.frac < 0.08) s.classList.add('dm-first');
        if (tk.frac === 1) s.classList.add('dm-last');
        axis.appendChild(s);
    });

    const show = (clientX) => {
        const r = svg.getBoundingClientRect();
        if (!(r.width > 0)) return;
        const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        const p = nearestPoint(pts, frac, x0, x1);
        if (!p) return;
        const x = (PAD + ((p[0] - x0) / (x1 - x0)) * (CHART_W - 2 * PAD)).toFixed(1);
        cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
        cursor.style.display = '';
        readout.textContent = `${fmtTime(p[0])} · ${fmt(p[1])}`;
        lab.textContent = '';
    };
    const hide = () => { cursor.style.display = 'none'; readout.textContent = ''; lab.textContent = summary; if (onHover) onHover(false); };
    svg.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (onHover) onHover(true); show(e.clientX); });
    svg.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) { if (onHover) onHover(true); show(e.clientX); } });
    svg.addEventListener('pointerup', hide);
    svg.addEventListener('pointercancel', hide);
    svg.addEventListener('pointerleave', hide);
    slot.append(head, svg, axis);
}

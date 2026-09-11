/**
 * 24-hour temperature trend for the room panel: a small sparkline drawn
 * from HA's history API, cached per entity for a few minutes so the
 * panel can re-render on every state tick without refetching.
 */
const TTL_MS = 5 * 60 * 1000;
const svgNS = 'http://www.w3.org/2000/svg';

/** Numeric [timestamp, value] points from a history/period response. */
export function parseHistory(res) {
    const list = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : [];
    return list.map(s => [Date.parse(s.last_changed || s.lu * 1000 || 0), Number(s.state)]).filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
}

/** Polyline points string for `pts` inside a w x h box (2px padding). */
export function sparklinePoints(pts, w = 120, h = 28) {
    if (pts.length < 2) return '';
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sx = x1 > x0 ? (w - 4) / (x1 - x0) : 0, sy = y1 > y0 ? (h - 4) / (y1 - y0) : 0;
    return pts.map(([x, y]) => `${(2 + (x - x0) * sx).toFixed(1)},${(h - 2 - (y - y0) * sy).toFixed(1)}`).join(' ');
}

export async function loadHistory(hass, id, hours = 24) {
    if (!hass || !hass.callApi) return [];
    const start = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const res = await hass.callApi('GET', `history/period/${start}?filter_entity_id=${encodeURIComponent(id)}&minimal_response&no_attributes`);
    return parseHistory(res);
}

function cached(host, id) {
    const c = host._histCache && host._histCache[id];
    return c && Date.now() - c.t < TTL_MS ? c : null;
}

/** Fill `slot` with the trend of `id`; fetches at most once per TTL. Returns the promise for tests. */
export function attachTrend(host, slot, id, unit = '°') {
    host._histCache = host._histCache || {};
    const draw = (pts) => {
        slot.replaceChildren();
        if (pts.length < 2) { slot.hidden = true; return; }
        slot.hidden = false;
        const vals = pts.map(p => p[1]);
        const min = Math.min(...vals), max = Math.max(...vals);
        const lab = document.createElement('span');
        lab.className = 'dm-rp-trend-label';
        lab.textContent = `24 h · ${Math.round(min * 10) / 10}${unit} – ${Math.round(max * 10) / 10}${unit}`;
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 120 28');
        svg.setAttribute('preserveAspectRatio', 'none');
        const line = document.createElementNS(svgNS, 'polyline');
        line.setAttribute('points', sparklinePoints(pts));
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', '1.6');
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(line);
        slot.append(lab, svg);
    };
    const hit = cached(host, id);
    if (hit && hit.pts) { draw(hit.pts); return Promise.resolve(hit.pts); }
    if (hit && hit.promise) return hit.promise.then(pts => { if (slot.parentNode) draw(pts); return pts; });
    slot.hidden = true;
    const entry = { t: Date.now() };
    entry.promise = loadHistory(host._hass, id).catch(() => []).then(pts => { entry.pts = pts; if (slot.parentNode) draw(pts); return pts; });
    host._histCache[id] = entry;
    return entry.promise;
}

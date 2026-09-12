/**
 * 24-hour temperature trend for the room panel: a small sparkline drawn
 * from HA's history API, cached per entity for a few minutes so the
 * panel can re-render on every state tick without refetching.
 */
import { drawTrend } from './TrendChart.js?v=3.2.1';

const TTL_MS = 5 * 60 * 1000;

/** Numeric [timestamp, value] points from a history/period response. */
export function parseHistory(res) {
    const list = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : [];
    const pts = list.map(s => [Date.parse(s.last_changed || s.lu * 1000 || 0), Number(s.state)]).filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
    return thin(pts, 240);
}

/** Keep at most `max` points (every n-th, always the last) so a chatty sensor stays a light polyline. */
export function thin(pts, max) {
    if (pts.length <= max) return pts;
    const step = Math.ceil(pts.length / max);
    const out = pts.filter((_, i) => i % step === 0);
    if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
    return out;
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
    const draw = (pts) => drawTrend(slot, pts, { unit, onHover: (on) => { host._rpHover = on; } });
    const hit = cached(host, id);
    if (hit && hit.pts) { draw(hit.pts); return Promise.resolve(hit.pts); }
    if (hit && hit.promise) return hit.promise.then(pts => { if (slot.parentNode) draw(pts); return pts; });
    slot.hidden = true;
    const entry = { t: Date.now() };
    entry.promise = loadHistory(host._hass, id).catch(() => []).then(pts => { entry.pts = pts; if (slot.parentNode) draw(pts); return pts; });
    host._histCache[id] = entry;
    return entry.promise;
}

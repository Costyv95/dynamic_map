import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.1';

/** Badge position as [x%, y%] whichever way it is stored. */
export function badgePercent(sc) {
    const p = sc && sc.position;
    if (Array.isArray(p)) return p;
    if (p && typeof p === 'object') return p.horizontal || p.vertical || null;
    return null;
}

/** The room a badge belongs to: its parent, else the polygon it sits in. */
export function roomOfBadge(rooms, sc) {
    if (!sc || !Array.isArray(rooms)) return null;
    if (sc.parent) { const r = rooms.find(x => x.id === sc.parent); if (r) return r; }
    const pct = badgePercent(sc);
    if (!pct) return null;
    return rooms.find(r => Array.isArray(r.polygon) && MapGeometry.isPointInPolygon(pct, r.polygon)) || null;
}

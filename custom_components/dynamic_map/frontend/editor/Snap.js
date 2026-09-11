import { shortcutFrame } from '../shared/ShortcutGeometry.js?v=3.2.1';
import { roomBox } from '../core/RoomLabels.js?v=3.2.1';

/**
 * Alignment snapping for drags: badge centres line up with other badges'
 * centres and with room centres/edges. Pure: returns the snapped point and
 * the guide lines to draw.
 */

/** Snap lines (map px) for a floor, excluding the badge being dragged. */
export function snapTargets({ shortcuts, rooms, imgW, imgH, mode, excludeId, hass }) {
    const xs = [], ys = [];
    (shortcuts || []).forEach(sc => {
        if (sc.id === excludeId) return;
        const f = shortcutFrame(sc, { mode, imgW, imgH, hass });
        xs.push({ v: f.x, kind: 'badge' });
        ys.push({ v: f.y, kind: 'badge' });
    });
    (rooms || []).forEach(room => {
        if (!room.polygon || !room.polygon.length) return;
        const b = roomBox(room, imgW, imgH);
        xs.push({ v: b.cx, kind: 'room' }, { v: b.cx - b.w / 2, kind: 'edge' }, { v: b.cx + b.w / 2, kind: 'edge' });
        ys.push({ v: b.cy, kind: 'room' }, { v: b.cy - b.h / 2, kind: 'edge' }, { v: b.cy + b.h / 2, kind: 'edge' });
    });
    return { xs, ys };
}

function nearest(list, value, tolerance) {
    let best = null;
    list.forEach(t => {
        const d = Math.abs(t.v - value);
        if (d <= tolerance && (!best || d < best.d)) best = { ...t, d };
    });
    return best;
}

/**
 * Snap (x, y) to the nearest targets within `tolerance` map px.
 * Returns { x, y, guides: [{ axis: 'x'|'y', value, kind }] }.
 */
export function snapPoint(x, y, targets, tolerance) {
    const guides = [];
    const sx = nearest(targets.xs, x, tolerance);
    const sy = nearest(targets.ys, y, tolerance);
    if (sx) { x = sx.v; guides.push({ axis: 'x', value: sx.v, kind: sx.kind }); }
    if (sy) { y = sy.v; guides.push({ axis: 'y', value: sy.v, kind: sy.kind }); }
    return { x, y, guides };
}

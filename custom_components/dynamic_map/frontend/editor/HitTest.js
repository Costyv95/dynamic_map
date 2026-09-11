/**
 * Small pure helpers for the editor tools: polygon edges, areas and the
 * screen-space resize cursor for a handle.
 */

/** Shoelace area of a polygon [[x, y], ...]; 0 for fewer than 3 points. */
export function polygonArea(poly) {
    if (!Array.isArray(poly) || poly.length < 3) return 0;
    let a = 0;
    for (let i = 0, n = poly.length; i < n; i++) {
        const [x1, y1] = poly[i];
        const [x2, y2] = poly[(i + 1) % n];
        a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a) / 2;
}

/** Closest point on segment a-b to p, with its parameter t in [0, 1]. */
export function projectOnSegment(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return { x: a[0] + t * dx, y: a[1] + t * dy, t };
}

/**
 * Screen-space resize cursor for a handle at local direction (lx, ly),
 * given the shape's total on-screen rotation (deg) and view mirror (fx, fy).
 * Rotate the local direction into screen space, mirror it, then bucket the
 * angle (mod 180, resize cursors are bidirectional) into the four CSS
 * resize cursors.
 */
export function resizeCursorFor(lx, ly, thetaDeg, fx = 1, fy = 1) {
    const t = (thetaDeg * Math.PI) / 180;
    let sx = lx * Math.cos(t) - ly * Math.sin(t);
    let sy = lx * Math.sin(t) + ly * Math.cos(t);
    sx *= fx;
    sy *= fy;
    let a = (Math.atan2(sy, sx) * 180) / Math.PI;
    a = ((a % 180) + 180) % 180;
    if (a < 22.5 || a >= 157.5) return 'ew-resize';
    if (a < 67.5) return 'nwse-resize';
    if (a < 112.5) return 'ns-resize';
    return 'nesw-resize';
}

/** Local unit direction for one of the 8 resize handles. */
export const HANDLE_DIRS = {
    N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0],
    NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1]
};

/**
 * Describe what an SVG event target is, using the data attributes the
 * scene and overlay put on their elements.
 */
export function describeTarget(target) {
    if (!target || !target.closest) return { kind: 'bg' };
    const handle = target.closest('[data-handle]');
    if (handle) {
        const d = handle.dataset;
        return {
            kind: 'handle', handle: d.handle,
            roomIdx: d.roomIdx !== undefined ? +d.roomIdx : undefined,
            vertexIdx: d.vertexIdx !== undefined ? +d.vertexIdx : undefined,
            edgeIdx: d.edgeIdx !== undefined ? +d.edgeIdx : undefined,
            wallIdx: d.wallIdx !== undefined ? +d.wallIdx : undefined
        };
    }
    const sc = target.closest('.shortcut-group');
    if (sc) return { kind: 'shortcut', id: sc.dataset.shortcutId || sc.id };
    const wall = target.closest('[data-wall-idx]');
    if (wall) return { kind: 'wall', wallIdx: +wall.dataset.wallIdx };
    const room = target.closest('.room-polygon');
    if (room) return { kind: 'room', id: room.dataset.roomId };
    return { kind: 'bg' };
}

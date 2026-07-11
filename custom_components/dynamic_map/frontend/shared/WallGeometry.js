/**
 * Wall model helpers, shared by the editor (drawing/hit-testing) and tests.
 *
 * A wall is a polyline with thickness, stored in config_floorN.json:
 *   { id, points: [[x%, y%], ...], thickness: <map px>, color: '#0f172a' }
 * Corners join cleanly because both renderers stroke one path per wall.
 */

export const WALL_DEFAULT_THICKNESS = 8;
export const WALL_DEFAULT_COLOR = '#0f172a';

/**
 * Axis-snap a new wall point against the previous one: segments within
 * ~10° of horizontal/vertical lock to the exact axis, so hand-clicked
 * walls come out as straight as a scanned plan. Points are percent coords.
 */
export function snapWallPoint(prev, pt, bgW = 1, bgH = 1) {
    if (!prev) return pt;
    const dx = (pt[0] - prev[0]) * bgW;
    const dy = (pt[1] - prev[1]) * bgH;
    if (dx === 0 && dy === 0) return pt;
    const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
    const toHoriz = Math.min(angle, 180 - angle);
    const toVert = Math.abs(90 - angle);
    if (toHoriz <= 10) return [pt[0], prev[1]];
    if (toVert <= 10) return [prev[0], pt[1]];
    return pt;
}

/** Distance (map px) from a point to a segment. */
export function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distance (map px) from a map-px point to the wall's centerline. */
export function distToWall(wall, px, py, bgW, bgH) {
    const pts = wall.points || [];
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
        const d = distToSegment(px, py,
            (pts[i][0] / 100) * bgW, (pts[i][1] / 100) * bgH,
            (pts[i + 1][0] / 100) * bgW, (pts[i + 1][1] / 100) * bgH);
        if (d < best) best = d;
    }
    return best;
}

/** True when a map-px point grabs the wall (its half-thickness plus slack). */
export function hitsWall(wall, px, py, bgW, bgH, slack = 6) {
    const reach = (Number(wall.thickness) > 0 ? wall.thickness : WALL_DEFAULT_THICKNESS) / 2 + slack;
    return distToWall(wall, px, py, bgW, bgH) <= reach;
}

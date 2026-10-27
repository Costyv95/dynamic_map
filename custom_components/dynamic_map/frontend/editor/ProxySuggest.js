/**
 * Proxies not yet placed on this floor, shown where they probably are: the
 * middle of the room whose area holds the proxy's device. They are drawn
 * faded; dragging or tapping one places it for real (one undo step).
 */
export function suggestedProxies(known, placed, rooms) {
    const have = new Set((placed || []).map(p => p.id));
    const out = [];
    (known || []).forEach(p => {
        if (have.has(p.id) || !p.area) return;
        const room = (rooms || []).find(r => r.area_id === p.area && Array.isArray(r.polygon) && r.polygon.length);
        if (room) out.push({ id: p.id, name: p.name, position: roomCenter(room.polygon), suggested: true });
    });
    return out;
}

/** Middle of the room's bounding box: a start to drag from, not a claim. */
export function roomCenter(polygon) {
    const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

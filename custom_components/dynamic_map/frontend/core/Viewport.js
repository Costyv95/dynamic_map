/**
 * Pure viewport math shared by the card and the editor: which way the map
 * turns for a given screen, how it is flipped, and the viewBox that frames
 * the rooms. No DOM.
 */

export const DEFAULT_FLIPS = () => ({
    horizontal: { h: false, v: false },
    vertical: { h: false, v: false }
});

const ROOM_PADDING = 0.15;

/** Bounding box of all room polygons in map pixels (null without rooms). */
export function roomBounds(rooms, imgW, imgH) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    (rooms || []).forEach(r => (r.polygon || []).forEach(pt => {
        const px = (pt[0] / 100) * imgW;
        const py = (pt[1] / 100) * imgH;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
    }));
    if (!Number.isFinite(minX)) return null;
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

/** Whether the map should be turned 90deg for this screen. */
export function shouldRotate(rotationMode, isMapLandscape, isScreenLandscape) {
    if (rotationMode === 'horizontal') return !isMapLandscape;
    if (rotationMode === 'vertical') return isMapLandscape;
    return isScreenLandscape !== isMapLandscape;
}

/** Expand a w/h to exactly fill the screen aspect ratio. */
export function fitToAspect(w, h, screenRatio) {
    if (w / h < screenRatio) return { w: h * screenRatio, h };
    return { w, h: w / screenRatio };
}

/**
 * Compute the viewport for a floor.
 * Returns { isRotated, activeMode, scaleX, scaleY, cx, cy, vb, transform }
 * where `transform` is the SVG transform for the map root ('' when none)
 * and scaleX/scaleY are the flip mirrors (1 or -1).
 */
export function computeViewport({ rooms, imgW, imgH, screenW, screenH, rotationMode = 'auto', flips }) {
    const sw = screenW > 0 ? screenW : 1;
    const sh = screenH > 0 ? screenH : 1;
    const screenRatio = sw / sh;
    const bounds = roomBounds(rooms, imgW, imgH);
    if (!bounds) {
        const vb = { x: 0, y: 0, w: imgW, h: imgH };
        return { isRotated: false, activeMode: imgW >= imgH ? 'horizontal' : 'vertical', scaleX: 1, scaleY: 1, cx: imgW / 2, cy: imgH / 2, vb, transform: '' };
    }
    let targetW = bounds.w * (1 + ROOM_PADDING * 2);
    let targetH = bounds.h * (1 + ROOM_PADDING * 2);
    const cx = bounds.minX + bounds.w / 2;
    const cy = bounds.minY + bounds.h / 2;

    const isMapLandscape = targetW > targetH;
    const isRotated = shouldRotate(rotationMode, isMapLandscape, screenRatio > 1);
    const activeMode = (isMapLandscape !== isRotated) ? 'horizontal' : 'vertical';

    const f = (flips || DEFAULT_FLIPS())[activeMode] || { h: false, v: false };
    let scaleX = 1, scaleY = 1;
    if (isRotated) {
        if (f.h) scaleY = -1;
        if (f.v) scaleX = -1;
    } else {
        if (f.h) scaleX = -1;
        if (f.v) scaleY = -1;
    }

    let transform = '';
    if (isRotated) transform += `rotate(90, ${cx}, ${cy}) `;
    if (scaleX !== 1 || scaleY !== 1) transform += `translate(${cx}, ${cy}) scale(${scaleX}, ${scaleY}) translate(${-cx}, ${-cy})`;
    transform = transform.trim();
    if (isRotated) [targetW, targetH] = [targetH, targetW];

    const fit = fitToAspect(targetW, targetH, screenRatio);
    const vb = { x: cx - fit.w / 2, y: cy - fit.h / 2, w: fit.w, h: fit.h };
    return { isRotated, activeMode, scaleX, scaleY, cx, cy, vb, transform };
}

/** Transform that keeps a label upright at its raw centre under `vp`. */
export function labelTransform(vp, rawCx, rawCy) {
    if (!vp.transform) return null;
    let s = `translate(${rawCx}, ${rawCy}) `;
    if (vp.scaleX !== 1 || vp.scaleY !== 1) s += `scale(${vp.scaleX}, ${vp.scaleY}) `;
    if (vp.isRotated) s += 'rotate(-90) ';
    s += `translate(${-rawCx}, ${-rawCy})`;
    return s;
}

/** Map a point from image coordinates into viewBox space (flips, then rotation). */
export function mapPointToView(vp, px, py) {
    let x = vp.cx + vp.scaleX * (px - vp.cx);
    let y = vp.cy + vp.scaleY * (py - vp.cy);
    if (vp.isRotated) {
        const rx = vp.cx - (y - vp.cy);
        const ry = vp.cy + (x - vp.cx);
        x = rx; y = ry;
    }
    return { x, y };
}

/** Inverse of mapPointToView: a viewBox point back to image coordinates. */
export function viewPointToMap(vp, vx, vy) {
    let x = vx, y = vy;
    if (vp.isRotated) {
        const px = vp.cx + (y - vp.cy);
        const py = vp.cy - (x - vp.cx);
        x = px; y = py;
    }
    return {
        x: vp.cx + (x - vp.cx) / vp.scaleX,
        y: vp.cy + (y - vp.cy) / vp.scaleY
    };
}

/**
 * viewBox that frames a room with padding, matching the screen aspect.
 * `mapPoint(px, py)` maps image pixels into viewBox space.
 */
export function roomViewBox({ mapPoint, room, imgW, imgH, screenRatio, minW }) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    room.polygon.forEach(pt => {
        const p = mapPoint((pt[0] / 100) * imgW, (pt[1] / 100) * imgH);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });
    const bw = Math.max(maxX - minX, 1);
    const bh = Math.max(maxY - minY, 1);
    const cx = minX + bw / 2;
    const cy = minY + bh / 2;
    let { w, h } = fitToAspect(bw * 1.24, bh * 1.24, screenRatio);
    if (w < minW) {
        h *= minW / w;
        w = minW;
    }
    return { x: cx - w / 2, y: cy - h / 2, w, h };
}

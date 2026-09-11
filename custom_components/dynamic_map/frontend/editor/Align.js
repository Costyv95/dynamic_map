import { shortcutFrame, writeFrame } from '../shared/ShortcutGeometry.js?v=3.2.1';

/**
 * Alignment and distribution for several selected badges. Works on frames
 * (map px); writes go through ShortcutGeometry so both layouts stay in
 * step with the editor's link setting.
 */

/** Frames of the given shortcuts in the active mode. */
export function framesOf(shortcuts, opts) {
    return shortcuts.map(sc => ({ sc, f: shortcutFrame(sc, opts) }));
}

/**
 * Target positions for `how`: left | center | right | top | middle | bottom,
 * relative to the primary badge (first in the list) when given, else the
 * selection's bounding box.
 */
export function alignTargets(frames, how, anchor = null) {
    const ref = anchor ? [anchor] : frames;
    const minX = Math.min(...ref.map(({ f }) => f.x - f.w / 2)), maxX = Math.max(...ref.map(({ f }) => f.x + f.w / 2));
    const minY = Math.min(...ref.map(({ f }) => f.y - f.h / 2)), maxY = Math.max(...ref.map(({ f }) => f.y + f.h / 2));
    return frames.map(({ sc, f }) => {
        const p = { sc };
        if (how === 'left') p.x = minX + f.w / 2;
        else if (how === 'right') p.x = maxX - f.w / 2;
        else if (how === 'center') p.x = (minX + maxX) / 2;
        else if (how === 'top') p.y = minY + f.h / 2;
        else if (how === 'bottom') p.y = maxY - f.h / 2;
        else if (how === 'middle') p.y = (minY + maxY) / 2;
        return p;
    });
}

/** Even spacing along an axis ('x' | 'y') between the outermost badges. */
export function distributeTargets(frames, axis) {
    if (frames.length < 3) return [];
    const key = axis === 'x' ? 'x' : 'y';
    const sorted = [...frames].sort((a, b) => a.f[key] - b.f[key]);
    const first = sorted[0].f[key], last = sorted[sorted.length - 1].f[key];
    const step = (last - first) / (sorted.length - 1);
    return sorted.map(({ sc }, i) => ({ sc, [key]: first + step * i }));
}

/** Apply target positions. */
export function applyTargets(targets, opts) {
    targets.forEach(({ sc, x, y }) => {
        const patch = {};
        if (x !== undefined) patch.x = x;
        if (y !== undefined) patch.y = y;
        if (Object.keys(patch).length) writeFrame(sc, patch, opts);
    });
}

/** Give every badge the primary's width/height (and rotation). */
export function matchSizeTargets(frames) {
    const [{ f: ref }, ...rest] = frames;
    return rest.map(({ sc }) => ({ sc, w: ref.w, h: ref.h, rotation: ref.rotation }));
}

export function applySizes(targets, opts) {
    targets.forEach(({ sc, w, h, rotation }) => writeFrame(sc, { w, h, rotation }, opts));
}

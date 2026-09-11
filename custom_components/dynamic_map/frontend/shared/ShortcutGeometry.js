import {
    getPosition, setPosition, getScale, setScale,
    getRotation, setRotation, isProportional
} from './OrientationProps.js?v=3.2.1';
import { computeSensorPill } from './SensorPill.js?v=3.2.1';

/**
 * The one place that turns a shortcut's stored keys into a frame on the
 * map, and the one place that writes a frame back. Used by the card, the
 * editor overlay and the hit tests, so all three agree by construction.
 *
 * Stored keys (unchanged, all optionally per-orientation):
 *   position [x%, y%]        lives on the shortcut only, never on a state
 *   scale / scaleX / scaleY  1.0 = a 24 map-unit badge
 *   rotation                 degrees, clockwise
 *   config.autoRotate        true = rotates with the map; false = upright
 *
 * Frame (map pixels, unrotated local box centred on x,y):
 *   { x, y, w, h, rotation, upright, shape, proportional, scaleX, scaleY }
 */

export const BASE_SIZE = 24;

/** Shape with state > config > shortcut > type default precedence. */
export function shortcutShape(sc, state = null) {
    const cfg = sc.config || {};
    return (state && state.shape) || cfg.shape || sc.shape
        || (sc.type === 'sensor' ? 'rect' : 'circle');
}

/** Whether the badge stays upright while the map rotates. */
export function isUpright(sc, state = null) {
    const cfg = sc.config || {};
    if (state && state.autoRotate !== undefined) return !state.autoRotate;
    return !cfg.autoRotate;
}

/** Unscaled pill size for a sensor (so a width can be turned into a scale). */
function sensorBaseSize(sc, state, hass) {
    const p = computeSensorPill({ sc, state, hass, scaleX: 1, scaleY: 1 });
    return { w: p.width, h: p.height };
}

/**
 * Resolve the frame for one orientation mode. `state` is the active (card)
 * or previewed (editor) state override, or null. `hass` only matters for
 * sensors, whose width follows the rendered text.
 */
export function shortcutFrame(sc, { mode = 'horizontal', state = null, imgW = 1000, imgH = 1000, hass = null } = {}) {
    const target = state || sc;
    const pos = getPosition(sc, mode);
    const { scaleX, scaleY } = getScale(sc, target, mode);
    const rotation = getRotation(sc, target, mode);
    const shape = shortcutShape(sc, state);
    let w = BASE_SIZE * scaleX;
    let h = BASE_SIZE * scaleY;
    if (sc.type === 'sensor') {
        const p = computeSensorPill({ sc, state, hass, scaleX, scaleY });
        w = p.width;
        h = p.height;
    }
    return {
        x: (pos[0] / 100) * imgW,
        y: (pos[1] / 100) * imgH,
        w, h, rotation,
        upright: isUpright(sc, state),
        shape,
        proportional: isProportional(sc),
        scaleX, scaleY
    };
}

/**
 * Write part of a frame back. `mode` is 'horizontal', 'vertical' or 'both'
 * (linked layouts). Position always goes to the shortcut; size and
 * rotation go to `state` when one is given (state override), else to the
 * shortcut. Width/height are map units and are converted to scales.
 */
export function writeFrame(sc, patch, { mode = 'both', state = null, imgW = 1000, imgH = 1000, hass = null } = {}) {
    const target = state || sc;
    if (patch.x !== undefined || patch.y !== undefined) {
        const cur = getPosition(sc, mode === 'both' ? 'horizontal' : mode);
        const px = patch.x !== undefined ? (patch.x / imgW) * 100 : cur[0];
        const py = patch.y !== undefined ? (patch.y / imgH) * 100 : cur[1];
        setPosition(sc, mode, px, py);
    }
    if (patch.w !== undefined || patch.h !== undefined) {
        const base = sc.type === 'sensor' ? sensorBaseSize(sc, state, hass) : { w: BASE_SIZE, h: BASE_SIZE };
        if (patch.w !== undefined) {
            const sx = Math.max(0.5, patch.w / base.w);
            setScale(sc, target, 'scaleX', mode, sx);
            if (!isProportional(sc)) setScale(sc, target, 'scale', mode, sx);
        }
        if (patch.h !== undefined) {
            const sy = Math.max(0.5, patch.h / base.h);
            setScale(sc, target, 'scaleY', mode, sy);
            if (!isProportional(sc)) setScale(sc, target, 'scale', mode, sy);
        }
    }
    if (patch.rotation !== undefined) {
        setRotation(target, mode, patch.rotation);
    }
}

/**
 * Total on-screen rotation of the badge's local box: its own rotation,
 * plus -90 when the map is rotated and the badge stays upright.
 */
export function screenRotation(frame, isRotated) {
    return (frame.rotation || 0) + ((isRotated && frame.upright) ? -90 : 0);
}

/**
 * Map a point in map pixels into the badge's local unrotated frame
 * (centre = 0,0), undoing the map counter-rotation and the badge rotation.
 */
export function toLocal(frame, px, py, isRotated = false) {
    let dx = px - frame.x;
    let dy = py - frame.y;
    if (isRotated && frame.upright) {
        // The badge carries rotate(-90); invert it with +90.
        const t = dx; dx = -dy; dy = t;
    }
    if (frame.rotation) {
        const rad = (-frame.rotation * Math.PI) / 180;
        const c = Math.cos(rad), s = Math.sin(rad);
        const rx = dx * c - dy * s;
        const ry = dx * s + dy * c;
        dx = rx; dy = ry;
    }
    return { x: dx, y: dy };
}

/** Inverse of toLocal: a point in the badge's local frame to map pixels. */
export function fromLocal(frame, lx, ly, isRotated = false) {
    let dx = lx, dy = ly;
    if (frame.rotation) {
        const rad = (frame.rotation * Math.PI) / 180;
        const c = Math.cos(rad), s = Math.sin(rad);
        const rx = dx * c - dy * s;
        const ry = dx * s + dy * c;
        dx = rx; dy = ry;
    }
    if (isRotated && frame.upright) {
        const t = dx; dx = dy; dy = -t;
    }
    return { x: frame.x + dx, y: frame.y + dy };
}

/** True when a map point lies inside the badge (rect or ellipse). */
export function hitsFrame(frame, px, py, isRotated = false, slack = 0) {
    const l = toLocal(frame, px, py, isRotated);
    const hw = frame.w / 2 + slack;
    const hh = frame.h / 2 + slack;
    if (frame.shape === 'rect') {
        return Math.abs(l.x) <= hw && Math.abs(l.y) <= hh;
    }
    return (l.x * l.x) / (hw * hw) + (l.y * l.y) / (hh * hh) <= 1;
}

/**
 * The transform string the card puts on a badge group: translate to the
 * map position, the badge's own rotation, then the card's counter
 * transforms (flip scale and the upright rotate(-90)).
 */
export function badgeTransform(frame, { isRotated = false, flipX = 1, flipY = 1 } = {}) {
    const parts = [`translate(${frame.x}, ${frame.y})`];
    if (frame.rotation) parts.push(`rotate(${frame.rotation})`);
    if (flipX !== 1 || flipY !== 1) parts.push(`scale(${flipX}, ${flipY})`);
    if (isRotated && frame.upright) parts.push('rotate(-90)');
    return parts.join(' ');
}

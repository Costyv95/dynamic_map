/**
 * A floor is drawn, not scanned: its size is `config.canvas` { w, h } in map
 * units, and everything on it (rooms, walls, furniture, doors, windows) is
 * vector data in that space. Floors saved before this carry no canvas and
 * still take their size from bg_floorN.png (legacy, read only).
 */

export const DEFAULT_CANVAS = { w: 1600, h: 1000 };

/** The floor's canvas from its config, or null for a legacy picture floor. */
export function floorCanvas(config) {
    const c = config && config.canvas;
    const w = c && Number(c.w), h = c && Number(c.h);
    return w > 0 && h > 0 ? { w, h } : null;
}

/** 'fit' (vector plate) or 'image' (legacy picture); a canvas means vector. */
export function floorBackgroundMode(config) {
    if (floorCanvas(config)) return 'fit';
    return (config && config.background_mode) || 'image';
}

/**
 * How far the floor plate reaches past the room outlines: half the
 * thickest wall when the floor has walls (the plate meets the wall's outer
 * face), else a soft 3.5% pad around a wall-less sketch.
 */
export function platePad(walls, imgW, imgH) {
    const thick = (walls || []).reduce((m, w) => Math.max(m, Number(w.thickness) || 0), 0);
    if (thick > 0) return thick / 2;
    return Math.max(imgW, imgH) * 0.035;
}

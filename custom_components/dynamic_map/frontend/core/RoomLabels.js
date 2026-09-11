import { estimateTextWidth } from '../shared/SensorPill.js?v=3.2.1';

/**
 * Room name labels that stay inside their room: shrink the font towards a
 * floor, and split long names on a space into two lines when the room is
 * too narrow for one line. Pure layout + a small SVG applier.
 */
const MIN_SCALE = 0.45;        // never smaller than 45% of the base size
const PADDING = 0.9;           // use at most 90% of the room width
const LETTER_SPACING_EM = 0.09; // matches .room-label's letter-spacing

function width(text, fontSize) {
    // Labels render uppercase with letter spacing.
    const upper = String(text).toUpperCase();
    return estimateTextWidth(upper, fontSize) + upper.length * LETTER_SPACING_EM * fontSize;
}

/** Split on the space closest to the middle; null when there is none. */
export function splitName(name) {
    const s = String(name).trim();
    const spaces = [...s].map((ch, i) => (ch === ' ' ? i : -1)).filter(i => i > 0);
    if (!spaces.length) return null;
    const mid = s.length / 2;
    const at = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best), spaces[0]);
    return [s.slice(0, at).trim(), s.slice(at + 1).trim()];
}

/**
 * Decide font size and lines for a room name in a box of roomW x roomH
 * (map px) given the base font size the card would use.
 */
export function layoutRoomLabel(name, roomW, roomH, baseSize) {
    const maxW = Math.max(roomW * PADDING, 1);
    const minSize = baseSize * MIN_SCALE;
    const fits = (lines, size) => lines.every(l => width(l, size) <= maxW);
    let size = baseSize;
    if (fits([name], size)) return { fontSize: size, lines: [name] };
    // Shrink a little first; if still too wide, try two lines; then shrink further.
    const oneLine = Math.max(minSize, Math.min(size, size * maxW / width(name, size)));
    const two = splitName(name);
    if (two && roomH >= baseSize * 2.2) {
        const twoLine = Math.max(minSize, Math.min(size, size * maxW / Math.max(width(two[0], size), width(two[1], size))));
        if (twoLine > oneLine * 1.15) return { fontSize: twoLine, lines: two };
    }
    return { fontSize: oneLine, lines: [name] };
}

/** Write lines/size into an SVG <text> centred on (cx, cy). */
export function applyRoomLabel(textEl, name, roomW, roomH, baseSize, cx, cy, svgNS) {
    const { fontSize, lines } = layoutRoomLabel(name, roomW, roomH, baseSize);
    textEl.setAttribute('font-size', fontSize.toString());
    while (textEl.firstChild) textEl.removeChild(textEl.firstChild);
    if (lines.length === 1) {
        textEl.textContent = lines[0];
        textEl.setAttribute('y', cy);
        return;
    }
    textEl.setAttribute('y', cy);
    lines.forEach((line, i) => {
        const tspan = document.createElementNS(svgNS, 'tspan');
        tspan.setAttribute('x', cx);
        tspan.setAttribute('dy', i === 0 ? `${-0.55 * fontSize}` : `${1.1 * fontSize}`);
        tspan.textContent = line;
        textEl.appendChild(tspan);
    });
}

/** Bounding box of a room polygon in map px. */
export function roomBox(room, imgW, imgH) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    room.polygon.forEach(pt => {
        const px = (pt[0] / 100) * imgW, py = (pt[1] / 100) * imgH;
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
    });
    return { cx: minX + (maxX - minX) / 2, cy: minY + (maxY - minY) / 2, w: maxX - minX, h: maxY - minY };
}

/**
 * Honeycomb colour picker for COLOR_PICKER overlay actions: a dense
 * hexagonal hue wheel (61 swatches in 4 rings). Hue follows the angle,
 * saturation grows smoothly from the warm-white centre to vivid edges.
 * Tapping a swatch calls light.turn_on with its rgb_color; the overlay
 * stays open so colours can be tried in sequence.
 */

const RINGS = 4;                     // 1 + 6 + 12 + 18 + 24 = 61 cells
const HEX_R = 11;                    // hexagon radius (px)
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

/** Axial coordinates for hex rings 0..RINGS. */
export function hexCells() {
    const cells = [{ q: 0, r: 0 }];
    for (let ring = 1; ring <= RINGS; ring++) {
        let q = DIRS[4][0] * ring;
        let r = DIRS[4][1] * ring;
        for (let side = 0; side < 6; side++) {
            for (let step = 0; step < ring; step++) {
                cells.push({ q, r });
                q += DIRS[side][0];
                r += DIRS[side][1];
            }
        }
    }
    return cells;
}

export function buildColorHoneycomb(mapContext, target, act) {
    const cellW = HEX_R * 2;             // flat-top hexagon width
    const cellH = Math.sqrt(3) * HEX_R;  // flat-top hexagon height

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '6px';
    if (act.name) {
        const label = document.createElement('span');
        label.textContent = act.name;
        label.style.fontSize = '12px';
        label.style.fontWeight = 'bold';
        label.style.alignSelf = 'flex-start';
        wrap.appendChild(label);
    }
    const gridW = 1.5 * HEX_R * RINGS * 2 + cellW + 8;
    const gridH = cellH * (RINGS * 2 + 1) + 8;
    const grid = document.createElement('div');
    grid.style.position = 'relative';
    grid.style.width = `${gridW}px`;
    grid.style.height = `${gridH}px`;
    wrap.appendChild(grid);
    const centerX = gridW / 2;
    const centerY = gridH / 2;

    hexCells().forEach(({ q, r }) => {
        const x = 1.5 * HEX_R * q;
        const y = cellH * (r + q / 2);
        const ring = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
        let rgb;
        if (ring === 0) {
            rgb = [255, 241, 224]; // warm white
        } else {
            const hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
            const sat = Math.round(25 + (ring / RINGS) * 72);
            const light = Math.round(72 - (ring / RINGS) * 18);
            rgb = hslToRgb(hue, sat, light);
        }
        const cell = document.createElement('div');
        cell.style.position = 'absolute';
        cell.style.left = `${centerX + x - cellW / 2}px`;
        cell.style.top = `${centerY + y - cellH / 2}px`;
        cell.style.width = `${cellW - 2}px`;
        cell.style.height = `${cellH - 2}px`;
        cell.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        cell.style.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
        cell.style.cursor = 'pointer';
        cell.style.transition = 'transform 0.15s ease, filter 0.15s ease';
        cell.addEventListener('pointerenter', () => { cell.style.filter = 'brightness(1.2)'; });
        cell.addEventListener('pointerleave', () => { cell.style.filter = ''; });
        cell.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!mapContext._hass) return;
            mapContext._hass.callService('light', 'turn_on', { entity_id: target, rgb_color: rgb });
            grid.querySelectorAll('div').forEach(c => { c.style.transform = ''; });
            cell.style.transform = 'scale(1.18)';
        });
        grid.appendChild(cell);
    });
    return wrap;
}

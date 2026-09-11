import { isTransparentFill } from '../shared/Color.js?v=3.2.1';

/**
 * Per-shortcut SVG <defs>: the badge gloss/shadow look and tiled image
 * patterns. All functions take the MapShortcut instance as `host`.
 */

/** Stable, id-safe suffix for this shortcut's SVG defs. */
export function defsUid(host) {
    if (!host._uid) {
        host._uid = String(host.sc.id || 'sc').replace(/[^a-zA-Z0-9_-]/g, '') || 'sc';
    }
    return host._uid;
}

export function ensureDefs(host) {
    if (!host.defsEl) {
        host.defsEl = document.createElementNS(host.svgNS, 'defs');
        host.group.insertBefore(host.defsEl, host.group.firstChild);
    }
    return host.defsEl;
}

/**
 * A rounded rect filled with the image repeated as square tiles (side =
 * shape height) instead of one stretched copy - for seamless textures
 * like LED strips or fairy-light garlands drawn to continue horizontally.
 */
export function buildTiledImage(host, comp) {
    const svgNS = host.svgNS;
    const defs = ensureDefs(host);
    const pid = `dm_tile_${defsUid(host)}`;
    let pattern = defs.querySelector(`pattern[id="${pid}"]`);
    if (!pattern) {
        pattern = document.createElementNS(svgNS, 'pattern');
        pattern.setAttribute('id', pid);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        const holder = document.createElementNS(svgNS, 'g');
        holder.appendChild(document.createElementNS(svgNS, 'image'));
        pattern.appendChild(holder);
        defs.appendChild(pattern);
    }
    const w = comp.width || 24;
    const h = comp.height || 24;
    // 'axis' tiles repeat along the rect's LONG side: the tile is a
    // square on the short side, and when the strip stands vertically the
    // artwork rotates 90deg so it still runs along the strip. 'both'
    // fills the rect in 2D (e.g. an LED pixel panel); tile_size sets the
    // density (defaults to the short side).
    const vertical = comp.tiling !== 'both' && h > w;
    const tile = Number(comp.tile_size) > 0 ? Number(comp.tile_size) : Math.min(w, h);
    pattern.setAttribute('x', ((comp.x || 0) - w / 2).toString());
    pattern.setAttribute('y', ((comp.y || 0) - h / 2).toString());
    pattern.setAttribute('width', tile.toString());
    pattern.setAttribute('height', tile.toString());
    // Rotate the artwork about the tile centre (not the lattice about the
    // user-space origin) so the tiles stay phase-anchored to the rect.
    const holder = pattern.querySelector('g');
    if (vertical) holder.setAttribute('transform', `rotate(90 ${tile / 2} ${tile / 2})`);
    else holder.removeAttribute('transform');
    const img = pattern.querySelector('image');
    img.setAttribute('width', tile.toString());
    img.setAttribute('height', tile.toString());
    img.setAttribute('href', comp.value || '');
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', comp.value || '');
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', ((comp.x || 0) - w / 2).toString());
    rect.setAttribute('y', ((comp.y || 0) - h / 2).toString());
    rect.setAttribute('width', w.toString());
    rect.setAttribute('height', h.toString());
    rect.setAttribute('rx', Math.min(tile * 0.25, 12).toString());
    rect.setAttribute('fill', `url(#${pid})`);
    return rect;
}

/**
 * Unified badge styling: every solid shape gets the same programmatic
 * "texture" (a top-left gloss + bottom edge shading overlay) and a soft
 * drop shadow. One consistent style for all shortcuts and states.
 */
export function applyBadgeDepth(host, el, comp) {
    if (isTransparentFill(comp.color || '')) return;
    // A borderless shape is architecture, not a badge: no gloss, no
    // drop shadow - a wall must read as flat ink like the floorplan.
    if (host.config.border === false) return;

    const svgNS = host.svgNS;
    const uid = defsUid(host);
    const defs = ensureDefs(host);

    if (!defs.querySelector(`#dm_gloss_${uid}`)) {
        const grad = document.createElementNS(svgNS, 'radialGradient');
        grad.setAttribute('id', `dm_gloss_${uid}`);
        grad.setAttribute('cx', '33%');
        grad.setAttribute('cy', '28%');
        grad.setAttribute('r', '80%');
        [['0%', '#ffffff', '0.45'], ['45%', '#ffffff', '0.13'], ['70%', '#ffffff', '0'], ['100%', '#000000', '0.18']]
            .forEach(([offset, color, opacity]) => {
                const stop = document.createElementNS(svgNS, 'stop');
                stop.setAttribute('offset', offset);
                stop.setAttribute('stop-color', color);
                stop.setAttribute('stop-opacity', opacity);
                grad.appendChild(stop);
            });
        defs.appendChild(grad);

        const filter = document.createElementNS(svgNS, 'filter');
        filter.setAttribute('id', `dm_shadow_${uid}`);
        filter.setAttribute('x', '-40%');
        filter.setAttribute('y', '-40%');
        filter.setAttribute('width', '180%');
        filter.setAttribute('height', '180%');
        const shadow = document.createElementNS(svgNS, 'feDropShadow');
        shadow.setAttribute('dx', '0');
        shadow.setAttribute('dy', '1.4');
        shadow.setAttribute('stdDeviation', '1.6');
        shadow.setAttribute('flood-opacity', '0.35');
        filter.appendChild(shadow);
        defs.appendChild(filter);
    }

    el.setAttribute('filter', `url(#dm_shadow_${uid})`);

    const gloss = el.cloneNode(false);
    gloss.removeAttribute('id');
    gloss.removeAttribute('filter');
    gloss.setAttribute('fill', `url(#dm_gloss_${uid})`);
    gloss.setAttribute('stroke', 'none');
    gloss.setAttribute('pointer-events', 'none');
    gloss.classList.add('dm-badge-gloss');
    host.bgGroup.appendChild(gloss);
}

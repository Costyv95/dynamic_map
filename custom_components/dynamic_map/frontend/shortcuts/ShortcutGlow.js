import { shiftHue, resolveEntityColor } from '../shared/Color.js?v=3.2.1';
import { defsUid } from './ShortcutDefs.js?v=3.2.1';
import { badgeSize } from './ShortcutFx.js?v=3.2.1';

/**
 * Light-pool glow: lights that are on cast soft pools in their live colour
 * that breathe and drift. The pool follows the badge's footprint (a strip
 * yields a line source), its reach scales with brightness up to
 * config.glow_strength, and it is clipped to the room containing the
 * light. Blobs live in map coordinates under mapRoot (outside the badge's
 * filtered subtree, which caused compositing flicker) and use screen
 * blending. Default for type 'light'; opt in/out via config.glow.
 * Functions take the MapShortcut instance as `host`.
 */

function makeRadial(svgNS, defs, id) {
    const grad = document.createElementNS(svgNS, 'radialGradient');
    grad.setAttribute('id', id);
    [['0%', '0.7'], ['50%', '0.3'], ['100%', '0']].forEach(([offset, opacity]) => {
        const stop = document.createElementNS(svgNS, 'stop');
        stop.setAttribute('offset', offset);
        stop.setAttribute('stop-opacity', opacity);
        grad.appendChild(stop);
    });
    defs.appendChild(grad);
    return grad;
}

/** Transparent -> bright -> transparent ACROSS a strip. */
function makeLineGradient(svgNS, defs, id) {
    const grad = document.createElementNS(svgNS, 'linearGradient');
    grad.setAttribute('id', id);
    [['0%', '0'], ['50%', '0.85'], ['100%', '0']].forEach(([offset, opacity]) => {
        const stop = document.createElementNS(svgNS, 'stop');
        stop.setAttribute('offset', offset);
        stop.setAttribute('stop-opacity', opacity);
        grad.appendChild(stop);
    });
    defs.appendChild(grad);
    return grad;
}

/** Mask that fades a strip's pool ALONG its two ends. */
function makeLineMask(host, defs, uid) {
    const svgNS = host.svgNS;
    const grad = document.createElementNS(svgNS, 'linearGradient');
    grad.setAttribute('id', `dm_glowend_${uid}`);
    ['0', '1', '1', '0'].forEach((opacity) => {
        const stop = document.createElementNS(svgNS, 'stop');
        stop.setAttribute('stop-color', '#fff');
        stop.setAttribute('stop-opacity', opacity);
        grad.appendChild(stop);
    });
    defs.appendChild(grad);
    const mask = document.createElementNS(svgNS, 'mask');
    mask.setAttribute('id', `dm_glowmask_${uid}`);
    mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('fill', `url(#dm_glowend_${uid})`);
    mask.appendChild(rect);
    defs.appendChild(mask);
    host._glowEndGrad = grad;
    host._glowMaskRect = rect;
}

function ensureGroup(host, uid) {
    if (host.glowGroup) return;
    const svgNS = host.svgNS;
    const host_ = (host.mapContext && host.mapContext.mapRoot) ? host.mapContext.mapRoot : host.group;
    host.glowGroup = document.createElementNS(svgNS, 'g');
    host.glowGroup.setAttribute('pointer-events', 'none');
    host.glowGroup.classList.add('dm-light-glow');
    host.glowDefs = document.createElementNS(svgNS, 'defs');
    host.glowGroup.appendChild(host.glowDefs);
    host._glowGrad = makeRadial(svgNS, host.glowDefs, `dm_glow_${uid}`);
    host._glowGrad2 = makeRadial(svgNS, host.glowDefs, `dm_glow2_${uid}`);
    host._glowLineGrad = makeLineGradient(svgNS, host.glowDefs, `dm_glowline_${uid}`);
    makeLineMask(host, host.glowDefs, uid);
    host.glowInner = document.createElementNS(svgNS, 'g');
    host.glowGroup.appendChild(host.glowInner);
    host.glowBlobs = [];
    if (host_ === host.group) {
        // No map context (tests/previews): keep the glow local.
        host.group.insertBefore(host.glowGroup, host.group.firstChild);
    } else {
        // Under the shortcut layer, above rooms and the floorplan. Must be
        // a DIRECT child: decor groups live in a nested sub-layer.
        const anchor = host_.querySelector(':scope > .dm-decor-layer, :scope > .shortcut-group');
        host_.insertBefore(host.glowGroup, anchor || null);
    }
}

/** Grow/shrink the pool to exactly n shapes of tag ('ellipse' | 'rect'). */
function ensureShapes(host, n, tag) {
    if (!host.glowBlobs) host.glowBlobs = [];
    if (host.glowBlobs.length && host.glowBlobs[0].tagName.toLowerCase() !== tag) {
        host.glowBlobs.forEach(e => e.parentNode && e.parentNode.removeChild(e));
        host.glowBlobs = [];
    }
    while (host.glowBlobs.length < n) {
        const e = document.createElementNS(host.svgNS, tag);
        e.style.mixBlendMode = 'screen';
        host.glowInner.appendChild(e);
        host.glowBlobs.push(e);
    }
    while (host.glowBlobs.length > n) {
        const e = host.glowBlobs.pop();
        if (e.parentNode) e.parentNode.removeChild(e);
    }
}

function layoutLine(host, uid, color, range, longAxis, shortAxis, horizontal) {
    const halfLen = longAxis / 2;
    const halfThick = shortAxis / 2;
    // Along the strip the pool spills only a little (the mask fades the
    // ends); across it the reach follows brightness but never past the
    // strip's own length, so a line source always reads as a line.
    const spill = range * 0.35;
    const hx = halfLen + spill;
    const hy = Math.min(halfThick + range, halfLen * 0.85);
    const aHalf = horizontal ? hx : hy;
    const bHalf = horizontal ? hy : hx;
    ensureShapes(host, 1, 'rect');
    const [x1, y1, x2, y2] = horizontal ? ['0', '0', '0', '1'] : ['0', '0', '1', '0'];
    host._glowLineGrad.setAttribute('x1', x1);
    host._glowLineGrad.setAttribute('y1', y1);
    host._glowLineGrad.setAttribute('x2', x2);
    host._glowLineGrad.setAttribute('y2', y2);
    host._glowLineGrad.querySelectorAll('stop').forEach(s => s.setAttribute('stop-color', color));
    const fade = Math.min(Math.max(spill / (2 * hx), 0.01), 0.45);
    host._glowEndGrad.setAttribute('x1', '0');
    host._glowEndGrad.setAttribute('y1', '0');
    host._glowEndGrad.setAttribute('x2', horizontal ? '1' : '0');
    host._glowEndGrad.setAttribute('y2', horizontal ? '0' : '1');
    const offsets = [0, fade, 1 - fade, 1];
    host._glowEndGrad.querySelectorAll('stop').forEach((s, i) => s.setAttribute('offset', offsets[i].toFixed(3)));
    const box = (el) => {
        el.setAttribute('x', (-aHalf).toFixed(1));
        el.setAttribute('y', (-bHalf).toFixed(1));
        el.setAttribute('width', (aHalf * 2).toFixed(1));
        el.setAttribute('height', (bHalf * 2).toFixed(1));
    };
    box(host._glowMaskRect);
    const rect = host.glowBlobs[0];
    box(rect);
    rect.removeAttribute('rx');
    rect.removeAttribute('ry');
    rect.setAttribute('fill', `url(#dm_glowline_${uid})`);
    rect.setAttribute('mask', `url(#dm_glowmask_${uid})`);
    rect.removeAttribute('opacity');
}

function layoutPoint(host, uid, range, baseW, baseH) {
    ensureShapes(host, 2, 'ellipse');
    const rx = baseW / 2 + range;
    const ry = baseH / 2 + range;
    const [b0, b1] = host.glowBlobs;
    b0.setAttribute('fill', `url(#dm_glow_${uid})`);
    b1.setAttribute('fill', `url(#dm_glow2_${uid})`);
    b0.removeAttribute('opacity'); b1.removeAttribute('opacity');
    b0.setAttribute('rx', rx.toFixed(1)); b0.setAttribute('ry', ry.toFixed(1));
    b0.setAttribute('cx', 0); b0.setAttribute('cy', 0);
    b1.setAttribute('rx', (rx * 0.65).toFixed(1)); b1.setAttribute('ry', (ry * 0.65).toFixed(1));
    b1.setAttribute('cx', 0); b1.setAttribute('cy', 0);
}

/** Clip the pool to the room containing the light: no light through walls. */
function updateClip(host, uid) {
    const mc = host.mapContext;
    if (!mc || !Array.isArray(mc.rooms) || typeof mc.isPointInPolygon !== 'function') return;
    const pxPct = (host.px / host.imgW) * 100;
    const pyPct = (host.py / host.imgH) * 100;
    const room = mc.rooms.find(r => r.polygon && mc.isPointInPolygon([pxPct, pyPct], r.polygon));
    const roomId = room ? room.id : null;
    if (roomId === host._glowClipRoom) return;
    host._glowClipRoom = roomId;
    let clip = host.glowDefs.querySelector(`#dm_clip_${uid}`);
    if (!room) {
        if (clip) clip.remove();
        host.glowGroup.removeAttribute('clip-path');
        return;
    }
    if (!clip) {
        clip = document.createElementNS(host.svgNS, 'clipPath');
        clip.setAttribute('id', `dm_clip_${uid}`);
        host.glowDefs.appendChild(clip);
    }
    while (clip.firstChild) clip.removeChild(clip.firstChild);
    const poly = document.createElementNS(host.svgNS, 'polygon');
    poly.setAttribute('points', room.polygon.map(p =>
        `${(p[0] / 100) * host.imgW},${(p[1] / 100) * host.imgH}`).join(' '));
    clip.appendChild(poly);
    host.glowGroup.setAttribute('clip-path', `url(#dm_clip_${uid})`);
}

export function updateGlow(host, hass) {
    const cfg = host.config;
    const wantsGlow = cfg.glow === true || (host.sc.type === 'light' && cfg.glow !== false);
    const target = host.sc.entity_id || cfg.state_entity;
    const st = target && hass && hass.states ? hass.states[target] : null;
    if (!(wantsGlow && st && st.state === 'on')) {
        host._glowVisible = false;
        if (host.glowGroup) host.glowGroup.style.display = 'none';
        return;
    }
    const uid = defsUid(host);
    ensureGroup(host, uid);

    // config.glow_color pins the hue for lights with no rgb_color.
    let color = cfg.glow_color || (host.activeState && host.activeState.color ? host.activeState.color : 'entity');
    color = resolveEntityColor(color, hass, target) || '#f59e0b';
    host._glowGrad.querySelectorAll('stop').forEach(stop => stop.setAttribute('stop-color', color));
    host._glowGrad2.querySelectorAll('stop').forEach(stop => stop.setAttribute('stop-color', shiftHue(color, 28)));

    const [baseW, baseH] = badgeSize(host);
    const strength = Number(cfg.glow_strength) > 0 ? Number(cfg.glow_strength) : 1;
    const bri = (st.attributes && Number.isFinite(st.attributes.brightness))
        ? Math.max(st.attributes.brightness / 255, 0.15) : 1;
    const range = host.imgW * 0.16 * strength * bri;
    const longAxis = Math.max(baseW, baseH);
    const shortAxis = Math.min(baseW, baseH);
    // An elongated rect (a strip) emits from a LINE; everything else from a
    // POINT. config.glow_shape forces the choice ('line' | 'area').
    const glowShape = cfg.glow_shape || 'auto';
    const isLine = host.shape && host.shape.tagName === 'rect'
        && glowShape !== 'area'
        && (glowShape === 'line' || (longAxis - shortAxis) > shortAxis * 0.6);
    host._glowLine = isLine;
    if (isLine) layoutLine(host, uid, color, range, longAxis, shortAxis, baseW >= baseH);
    else layoutPoint(host, uid, range, baseW, baseH);
    // Back-compat handles for tests / callers.
    host.glowEl = host.glowBlobs[0];
    host.glowBlob2 = host.glowBlobs[1];

    if (host.glowGroup.parentNode !== host.group) {
        host._applyGlowTransform();
        updateClip(host, uid);
    }
    host.glowGroup.style.display = 'block';
    host._glowVisible = true;
}

/** Per-frame step: pools breathe; point pools drift and intertwine. */
export function animateGlow(host, t) {
    if (!(host._glowVisible && host.glowBlobs && host.glowBlobs.length)) return;
    const k = 0.88 + 0.12 * Math.sin(t * 0.9);
    host.glowInner.setAttribute('opacity', k.toFixed(3));
    if (host._glowLine) {
        host.glowBlobs.forEach(b => b.removeAttribute('transform'));
        return;
    }
    const d = host.imgW * 0.008;
    host.glowBlobs.forEach((b, i) => {
        const px = Math.sin(t * (0.50 + i * 0.13) + i) * d * (1 + (i % 2) * 0.5);
        const py = Math.cos(t * (0.37 + i * 0.11) + i * 1.7) * d * (1 + (i % 2) * 0.3);
        b.setAttribute('transform', `translate(${px.toFixed(1)}, ${py.toFixed(1)})`);
    });
}

import { shortcutFrame, badgeTransform, screenRotation } from '../shared/ShortcutGeometry.js?v=3.2.1';
import { resizeCursorFor, HANDLE_DIRS } from './HitTest.js?v=3.2.1';
import { WALL_DEFAULT_THICKNESS, WALL_DEFAULT_COLOR } from '../shared/WallGeometry.js?v=3.2.1';

const ACCENT = '#0ea5e9';
// Handles grow on touch screens (coarse pointer) so fingers can grab them.
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 1.7 : 1;
const HANDLE_PX = 5 * COARSE;      // half-size of a resize handle on screen
const VERTEX_PX = 8 * COARSE;      // room corner handle radius on screen
const ROT_STEM_PX = 18 * COARSE;

/**
 * The editing layer: an SVG group that shares the map root's transform so
 * everything is drawn in map pixels, with handle sizes scaled by 1/zoom so
 * they stay constant on screen. Rebuilt on every render(); elements carry
 * data-handle attributes the tools use to know what was grabbed.
 */
export class EditOverlay {
    constructor(svgNS) {
        this.svgNS = svgNS;
        this.root = document.createElementNS(svgNS, 'g');
        this.root.classList.add('dm-edit-overlay');
    }

    el(tag, attrs = {}, parent = this.root) {
        const e = document.createElementNS(this.svgNS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        parent.appendChild(e);
        return e;
    }

    setTransform(transform) {
        if (transform) this.root.setAttribute('transform', transform);
        else this.root.removeAttribute('transform');
    }

    /** ctx: { state, host, imgW, imgH, pxPerUnit, vp, hass } */
    render(ctx) {
        while (this.root.firstChild) this.root.removeChild(this.root.firstChild);
        const { state } = ctx;
        const k = 1 / Math.max(ctx.pxPerUnit, 1e-6);
        this.renderRooms(ctx, k);
        this.renderGuides(ctx, k);
        this.renderDrawingPolygon(ctx, k);
        this.renderSplitLine(ctx, k);
        if (state.activeLayer === 'walls') this.renderWalls(ctx, k);
        else this.renderShortcuts(ctx, k);
    }

    toPx(ctx, pt) {
        return [(pt[0] / 100) * ctx.imgW, (pt[1] / 100) * ctx.imgH];
    }

    renderRooms(ctx, k) {
        const { state } = ctx;
        state.selectedRooms.forEach(idx => {
            const room = state.rooms[idx];
            if (!room || !room.polygon) return;
            const pts = room.polygon.map(p => this.toPx(ctx, p));
            this.el('polygon', {
                points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: ACCENT,
                'stroke-width': 2.5 * k, 'stroke-dasharray': `${6 * k} ${4 * k}`, 'pointer-events': 'none'
            });
            if (!state.isEditMode || state.selectedRooms.length !== 1) return;
            // Edge hit-lines (insert a corner) then corner handles on top.
            pts.forEach((a, i) => {
                const b = pts[(i + 1) % pts.length];
                this.el('line', {
                    x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'rgba(0,0,0,0)', 'stroke-width': 14 * k,
                    'data-handle': 'edge', 'data-room-idx': idx, 'data-edge-idx': i, style: 'cursor: copy;'
                });
            });
            pts.forEach((p, i) => {
                this.el('circle', {
                    cx: p[0], cy: p[1], r: VERTEX_PX * k, fill: '#ffffff', stroke: ACCENT, 'stroke-width': 2 * k,
                    'data-handle': 'vertex', 'data-room-idx': idx, 'data-vertex-idx': i, style: 'cursor: move;'
                });
            });
        });
    }

    /** Dashed alignment lines while a drag snaps to a badge or room. */
    renderGuides(ctx, k) {
        const guides = ctx.state.snapGuides;
        if (!guides || !guides.length) return;
        guides.forEach(g => {
            const color = g.kind === 'badge' ? '#f472b6' : ACCENT;
            const attrs = g.axis === 'x'
                ? { x1: g.value, y1: 0, x2: g.value, y2: ctx.imgH }
                : { x1: 0, y1: g.value, x2: ctx.imgW, y2: g.value };
            this.el('line', { ...attrs, stroke: color, 'stroke-width': 1 * k, 'stroke-dasharray': `${5 * k} ${4 * k}`, 'pointer-events': 'none', opacity: 0.9 });
        });
    }

    renderDrawingPolygon(ctx, k) {
        const poly = ctx.state.drawingPolygon;
        if (!poly || !poly.length) return;
        const pts = poly.map(p => this.toPx(ctx, p));
        if (pts.length > 1) {
            this.el('polyline', {
                points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: '#00ffaa',
                'stroke-width': 2 * k, 'stroke-dasharray': `${8 * k} ${6 * k}`, 'pointer-events': 'none'
            });
        }
        pts.forEach((p, i) => this.el('circle', {
            cx: p[0], cy: p[1], r: 7 * k, fill: i === 0 ? '#00ffaa' : '#ffffff', stroke: '#00ffaa',
            'stroke-width': 2 * k, 'pointer-events': 'none'
        }));
    }

    renderSplitLine(ctx, k) {
        const { state } = ctx;
        if (!state.isSplitting || !state.splitStart || !state.splitEnd) return;
        this.el('line', {
            x1: state.splitStart.x, y1: state.splitStart.y, x2: state.splitEnd.x, y2: state.splitEnd.y,
            stroke: '#ff00ff', 'stroke-width': 2 * k, 'pointer-events': 'none'
        });
    }

    renderWalls(ctx, k) {
        const { state } = ctx;
        const sel = state.walls[state.selectedWallIdx];
        if (sel && sel.points.length) {
            const pts = sel.points.map(p => this.toPx(ctx, p));
            this.el('polyline', {
                points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: ACCENT,
                'stroke-width': 1.5 * k, 'stroke-dasharray': `${6 * k} ${4 * k}`, 'pointer-events': 'none'
            });
            pts.forEach((p, i) => this.el('circle', {
                cx: p[0], cy: p[1], r: 5 * k, fill: '#ffffff', stroke: ACCENT, 'stroke-width': 1.5 * k,
                'data-handle': 'wall-vertex', 'data-wall-idx': state.selectedWallIdx, 'data-vertex-idx': i,
                style: 'cursor: move;'
            }));
        }
        const drawing = state.drawingWall;
        if (!drawing) return;
        const pts = drawing.map(p => this.toPx(ctx, p));
        if (pts.length >= 2) {
            this.el('polyline', {
                points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: WALL_DEFAULT_COLOR,
                'stroke-width': state.lastWallThickness || WALL_DEFAULT_THICKNESS, 'stroke-linecap': 'square',
                'stroke-linejoin': 'miter', 'pointer-events': 'none'
            });
        }
        if (pts.length >= 1 && state.wallCursor) {
            const last = pts[pts.length - 1];
            this.el('line', {
                x1: last[0], y1: last[1], x2: state.wallCursor.x, y2: state.wallCursor.y, stroke: ACCENT,
                'stroke-width': 2 * k, 'stroke-dasharray': `${6 * k} ${4 * k}`, 'pointer-events': 'none'
            });
        }
        pts.forEach(p => this.el('circle', { cx: p[0], cy: p[1], r: 4 * k, fill: ACCENT, 'pointer-events': 'none' }));
    }

    renderShortcuts(ctx, k) {
        const { state, vp } = ctx;
        const isRotated = !!(vp && vp.isRotated);
        const flipX = vp ? vp.scaleX : 1, flipY = vp ? vp.scaleY : 1;
        const mode = ctx.host.activeMode || 'horizontal';
        state.shortcuts.forEach((sc, idx) => {
            const layer = (sc.config && sc.config.decor) ? 'decor' : 'objects';
            if (layer !== state.activeLayer) return;
            const selected = idx === state.selectedShortcutIdx;
            const extra = !selected && (state.selectedExtra || []).includes(idx);
            const previewState = selected && state.previewStateIdx !== -1 ? sc.config?.states?.[state.previewStateIdx] : null;
            const frame = shortcutFrame(sc, { mode, state: previewState || null, imgW: ctx.imgW, imgH: ctx.imgH, hass: ctx.hass });
            const cfg = sc.config || {};
            const invisible = cfg.transparent && !cfg.icon && !cfg.image && sc.type !== 'sensor';
            if (!selected && !extra && !(state.isEditMode && invisible)) return;
            const g = this.el('g', { transform: badgeTransform(frame, { isRotated, flipX, flipY }) });
            const box = { x: -frame.w / 2, y: -frame.h / 2, width: frame.w, height: frame.h };
            if (extra) {
                this.el('rect', { ...box, fill: 'none', stroke: ACCENT, 'stroke-width': 1.5 * k, 'stroke-dasharray': `${4 * k} ${3 * k}`, 'pointer-events': 'none' }, g);
                return;
            }
            if (!selected) {
                // Invisible on the dashboard by design; hint its footprint.
                this.el('rect', { ...box, fill: 'none', stroke: 'rgba(100, 116, 139, 0.55)', 'stroke-width': 1.5 * k,
                    'stroke-dasharray': `${6 * k} ${4 * k}`, 'pointer-events': 'none' }, g);
                return;
            }
            this.el('rect', { ...box, fill: 'none', stroke: ACCENT, 'stroke-width': 2 * k, 'pointer-events': 'none' }, g);
            this.renderHandles(g, frame, k, screenRotation(frame, isRotated), flipX, flipY);
            // Inside the badge group the axes already include the badge's
            // own rotation and, for upright badges, the map counter-turn;
            // undo what is left so the name reads horizontally.
            const textRot = -(frame.rotation || 0) - ((isRotated && !frame.upright) ? 90 : 0);
            const label = this.el('text', {
                x: 0, y: frame.h / 2 + 12 * k, 'text-anchor': 'middle', 'font-size': 11 * k,
                fill: '#1e293b', 'paint-order': 'stroke', stroke: '#ffffff', 'stroke-width': 3 * k,
                'pointer-events': 'none', transform: `rotate(${textRot} 0 ${frame.h / 2 + 12 * k})`
            }, g);
            label.textContent = sc.name || 'Shortcut';
        });
    }

    renderHandles(g, frame, k, theta, fx, fy) {
        const hs = HANDLE_PX * k;
        Object.entries(HANDLE_DIRS).forEach(([name, [dx, dy]]) => {
            const x = dx * frame.w / 2, y = dy * frame.h / 2;
            this.el('rect', {
                x: x - hs, y: y - hs, width: hs * 2, height: hs * 2, fill: '#ffffff', stroke: '#1e293b',
                'stroke-width': 1 * k, 'data-handle': name, style: `cursor: ${resizeCursorFor(dx, dy, theta, fx, fy)};`
            }, g);
        });
        const stem = ROT_STEM_PX * k;
        this.el('line', { x1: 0, y1: -frame.h / 2, x2: 0, y2: -frame.h / 2 - stem, stroke: ACCENT, 'stroke-width': 1.5 * k, 'pointer-events': 'none' }, g);
        this.el('circle', { cx: 0, cy: -frame.h / 2 - stem, r: hs * 1.4, fill: ACCENT, stroke: '#ffffff', 'stroke-width': 1 * k,
            'data-handle': 'ROT', style: 'cursor: grab;' }, g);
    }
}

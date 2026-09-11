import { shortcutFrame, writeFrame, toLocal } from '../../shared/ShortcutGeometry.js?v=3.2.1';

const HANDLES = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'ROT'];

/**
 * Select, drag, resize and rotate badges (objects / decor layers). The
 * router hands it pointer events with `hit` (see HitTest.describeTarget)
 * and `pt` (map pixels).
 */
export class ShortcutTool {
    constructor(canvas, state) {
        this.canvas = canvas;
        this.state = state;
        this.mode = null;   // 'drag' | 'resize' | 'rotate'
        this.moved = false;
    }

    get sc() { return this.state.shortcuts[this.state.selectedShortcutIdx]; }

    geomOpts() {
        const state = this.state;
        const sc = this.sc;
        const preview = state.previewStateIdx !== -1 ? sc?.config?.states?.[state.previewStateIdx] : null;
        return {
            mode: this.canvas.activeMode, state: preview || null,
            imgW: this.canvas.imgW, imgH: this.canvas.imgH, hass: this.canvas._hass
        };
    }

    /** 'both' unless orientation linking was turned off in the toolbar. */
    writeMode() {
        return this.canvas.linkOrientations === false ? this.canvas.activeMode : 'both';
    }

    frame() { return shortcutFrame(this.sc, this.geomOpts()); }

    select(idx) {
        this.state.selectedShortcutIdx = idx;
        this.state.selectedRooms = [];
        this.state.selectedWallIdx = -1;
        this.state.updateUICallback();
        this.state.requestDrawCallback();
    }

    onDown(e, hit, pt) {
        if (hit.kind === 'handle' && this.sc && HANDLES.includes(hit.handle)) {
            this.mode = hit.handle === 'ROT' ? 'rotate' : 'resize';
            this.handle = hit.handle;
            this.moved = false;
            return true;
        }
        if (hit.kind === 'shortcut') {
            const idx = this.state.shortcuts.findIndex(s => s.id === hit.id);
            if (idx === -1) return false;
            const sc = this.state.shortcuts[idx];
            const layer = (sc.config && sc.config.decor) ? 'decor' : 'objects';
            if (layer !== this.state.activeLayer) return false;
            if (idx !== this.state.selectedShortcutIdx) this.select(idx);
            const f = this.frame();
            // Keep the grab point: dragging moves by the pointer's delta.
            this.grab = { dx: f.x - pt.x, dy: f.y - pt.y };
            this.mode = 'drag';
            this.moved = false;
            return true;
        }
        return false;
    }

    onMove(e, pt) {
        if (!this.mode || !this.sc) return false;
        this.moved = true;
        const opts = { ...this.geomOpts(), mode: this.writeMode() };
        if (this.mode === 'drag') {
            writeFrame(this.sc, { x: pt.x + this.grab.dx, y: pt.y + this.grab.dy }, opts);
        } else if (this.mode === 'rotate') {
            this.applyRotate(pt, opts);
        } else {
            this.applyResize(pt, opts);
        }
        this.state.requestDrawCallback();
        if (this.mode !== 'drag') this.state.updateUICallback();
        return true;
    }

    /** Handle sticks out of the top edge: pointer straight up = 0deg. Soft-snap to 15deg. */
    applyRotate(pt, opts) {
        const f = this.frame();
        const l = toLocal({ ...f, rotation: 0 }, pt.x, pt.y, this.canvas.isRotated);
        let ang = Math.atan2(l.y, l.x) * 180 / Math.PI + 90;
        const snap = Math.round(ang / 15) * 15;
        if (Math.abs(ang - snap) <= 4) ang = snap;
        ang = ((Math.round(ang) % 360) + 360) % 360;
        writeFrame(this.sc, { rotation: ang }, opts);
    }

    /** Drag point in the badge's local frame sets the half-extent on that axis. */
    applyResize(pt, opts) {
        const f = this.frame();
        const l = toLocal(f, pt.x, pt.y, this.canvas.isRotated);
        const h = this.handle;
        const patch = {};
        if (h.includes('E') || h.includes('W')) patch.w = Math.abs(l.x) * 2;
        if (h.includes('N') || h.includes('S')) patch.h = Math.abs(l.y) * 2;
        if (f.proportional) {
            const size = patch.w !== undefined ? patch.w : patch.h;
            patch.w = size; patch.h = size;
        }
        writeFrame(this.sc, patch, opts);
    }

    onUp() {
        const was = this.mode;
        this.mode = null;
        if (!was) return false;
        if (this.moved) {
            this.state.saveState();
            this.state.updateUICallback();
        }
        this.state.requestDrawCallback();
        return true;
    }
}

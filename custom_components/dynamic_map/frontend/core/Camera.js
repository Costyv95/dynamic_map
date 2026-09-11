/**
 * ViewBox camera driven by Pointer Events: one-finger / mouse pan, two-
 * finger pinch, wheel zoom. Works on any host with `vb`, `defaultVb`,
 * `imgW`, `updateViewBox()` and optional `onManualCameraStart()` /
 * `onCameraReset()`. The caller forwards pointer events (so an editor can
 * decide when a drag is a pan and when it is a tool); wheel is bound here.
 *
 * `maxOut` is how far past the default view the user may zoom out (1 =
 * snap back to the default like the card; larger values allow overview).
 */
export class Camera {
    constructor(svg, host, { maxOut = 1, minFraction = 0.05, bindWheel = true } = {}) {
        this.svg = svg;
        this.host = host;
        this.maxOut = maxOut;
        this.minFraction = minFraction;
        this.pointers = new Map();
        this.panning = false;
        this.dragged = false;
        this.pinch = null;
        this._onWheel = (e) => this.wheel(e);
        if (bindWheel) svg.addEventListener('wheel', this._onWheel, { passive: false });
    }

    destroy() {
        this.svg.removeEventListener('wheel', this._onWheel);
    }

    /** Screen pixels per viewBox unit. */
    scale() {
        const rect = this.svg.getBoundingClientRect();
        return rect.width > 0 && this.host.vb ? rect.width / this.host.vb.w : 1;
    }

    /** Client coordinates to viewBox coordinates. */
    screenToView(clientX, clientY) {
        const rect = this.svg.getBoundingClientRect();
        const vb = this.host.vb;
        const w = rect.width > 0 ? rect.width : 1;
        const h = rect.height > 0 ? rect.height : 1;
        return {
            x: vb.x + ((clientX - rect.left) / w) * vb.w,
            y: vb.y + ((clientY - rect.top) / h) * vb.h
        };
    }

    /** Begin a pan from this pointer (call from pointerdown when appropriate). */
    startPan(e) {
        this.panning = true;
        this.dragged = false;
        this.host._cameraDragged = false;
        this.panStart = { x: e.clientX, y: e.clientY };
        this.startVb = { x: this.host.vb.x, y: this.host.vb.y };
    }

    pointerDown(e) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.pointers.size === 2) this._beginPinch();
    }

    pointerMove(e) {
        if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.pinch && this.pointers.size >= 2) {
            this._movePinch();
            return true;
        }
        if (!this.panning) return false;
        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;
        if (!this.dragged && Math.hypot(dx, dy) > 4) {
            this.dragged = true;
            this.host._cameraDragged = true;
            if (this.host.onManualCameraStart) this.host.onManualCameraStart();
        }
        if (!this.dragged) return false;
        const rect = this.svg.getBoundingClientRect();
        const w = rect.width > 0 ? rect.width : 1;
        const h = rect.height > 0 ? rect.height : 1;
        this.host.vb.x = this.startVb.x - dx * (this.host.vb.w / w);
        this.host.vb.y = this.startVb.y - dy * (this.host.vb.h / h);
        this.host.updateViewBox();
        return true;
    }

    pointerUp(e) {
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.pinch = null;
        const wasPan = this.panning;
        this.panning = false;
        return wasPan && this.dragged;
    }

    _beginPinch() {
        const [a, b] = [...this.pointers.values()];
        this.panning = false;
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), vb: { ...this.host.vb } };
        if (this.host.onManualCameraStart) this.host.onManualCameraStart();
    }

    _movePinch() {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const factor = this.pinch.dist / dist;
        this.zoomTo(this.pinch.vb.w * factor, (a.x + b.x) / 2, (a.y + b.y) / 2, this.pinch.vb);
    }

    wheel(e) {
        e.preventDefault();
        if (this.host.onManualCameraStart) this.host.onManualCameraStart();
        let factor = Math.exp(e.deltaY * 0.001);
        factor = Math.max(0.8, Math.min(1.2, factor));
        this.zoomTo(this.host.vb.w * factor, e.clientX, e.clientY, this.host.vb);
    }

    /**
     * Set the viewBox width to `newW`, keeping the map point under the
     * screen position (clientX, clientY) fixed. `from` is the viewBox the
     * anchor is measured in (the pre-pinch box during a pinch).
     */
    zoomTo(newW, clientX, clientY, from) {
        const host = this.host;
        const def = host.defaultVb || from;
        const maxW = def.w * this.maxOut;
        if (newW >= maxW * 0.99) {
            if (this.maxOut === 1) {
                host.vb = { ...def };
                host.updateViewBox();
                if (host.onCameraReset) host.onCameraReset();
                return;
            }
            newW = maxW;
        }
        if (newW < host.imgW * this.minFraction) return;
        const rect = this.svg.getBoundingClientRect();
        const w = rect.width > 0 ? rect.width : 1;
        const h = rect.height > 0 ? rect.height : 1;
        const fx = (clientX - rect.left) / w;
        const fy = (clientY - rect.top) / h;
        const ax = from.x + fx * from.w;
        const ay = from.y + fy * from.h;
        const ratio = from.h / from.w;
        host.vb = { w: newW, h: newW * ratio, x: ax - fx * newW, y: ay - fy * newW * ratio };
        host.updateViewBox();
    }
}

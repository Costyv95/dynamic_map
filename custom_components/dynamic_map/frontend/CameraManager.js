export class CameraManager {
    constructor(svg, mapInstance) {
        this.svg = svg;
        this.map = mapInstance;
        
        this.isPanning = false;
        this.startPan = { x: 0, y: 0 };
        this.startVB = { x: 0, y: 0 };
        this.initialPinchDist = null;
        
        // State variables used during interactions
        this.initialVbW = 0;
        this.initialVbH = 0;
        this.initialVbX = 0;
        this.initialVbY = 0;

        this._setupListeners();
    }

    _getEventPos(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    _onPointerDown(e) {
        this.isPanning = true;
        const pos = this._getEventPos(e);
        this.startPan = { x: pos.x, y: pos.y };
        this.startVB = { x: this.map.vb.x, y: this.map.vb.y };
    }

    _onPointerMove(e) {
        if (e.touches && e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            if (!this.initialPinchDist) {
                this.initialPinchDist = dist;
                this.initialVbW = this.map.vb.w;
                this.initialVbH = this.map.vb.h;
                this.initialVbX = this.map.vb.x;
                this.initialVbY = this.map.vb.y;
            } else {
                const zoomFactor = this.initialPinchDist / dist;
                const newW = this.initialVbW * zoomFactor;
                const newH = this.initialVbH * zoomFactor;

                if (newW >= this.map.defaultVb.w * 0.99) {
                    this.map.vb = { ...this.map.defaultVb };
                } else {
                    if (newW < (this.map.imgW * 0.05)) return;

                    const rect = this.svg.getBoundingClientRect();
                    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                    const mouseX = cx - rect.left;
                    const mouseY = cy - rect.top;

                    const vx = this.initialVbX + (mouseX / rect.width) * this.initialVbW;
                    const vy = this.initialVbY + (mouseY / rect.height) * this.initialVbH;

                    this.map.vb.w = newW;
                    this.map.vb.h = newH;
                    this.map.vb.x = vx - (mouseX / rect.width) * this.map.vb.w;
                    this.map.vb.y = vy - (mouseY / rect.height) * this.map.vb.h;
                }
                this.map.updateViewBox();
            }
            return;
        }

        if (!this.isPanning) return;
        e.preventDefault();
        const pos = this._getEventPos(e);
        const dx = pos.x - this.startPan.x;
        const dy = pos.y - this.startPan.y;

        const rect = this.svg.getBoundingClientRect();
        const scaleX = this.map.vb.w / rect.width;
        const scaleY = this.map.vb.h / rect.height;

        this.map.vb.x = this.startVB.x - (dx * scaleX);
        this.map.vb.y = this.startVB.y - (dy * scaleY);
        this.map.updateViewBox();
    }

    _onPointerUp() {
        this.isPanning = false;
        this.initialPinchDist = null;
    }

    _onWheel(e) {
        e.preventDefault();
        const rect = this.svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const vx = this.map.vb.x + (mouseX / rect.width) * this.map.vb.w;
        const vy = this.map.vb.y + (mouseY / rect.height) * this.map.vb.h;

        const zoomSpeed = 0.001;
        let zoomFactor = Math.exp(-e.deltaY * zoomSpeed);
        if (zoomFactor > 1.2) zoomFactor = 1.2;
        if (zoomFactor < 0.8) zoomFactor = 0.8;

        const viewZoom = 1 / zoomFactor;
        const newW = this.map.vb.w * viewZoom;

        if (newW >= this.map.defaultVb.w * 0.99) {
            this.map.vb = { ...this.map.defaultVb };
        } else {
            if (newW < (this.map.imgW * 0.05)) return;
            this.map.vb.w = newW;
            this.map.vb.h *= viewZoom;
            this.map.vb.x = vx - (mouseX / rect.width) * this.map.vb.w;
            this.map.vb.y = vy - (mouseY / rect.height) * this.map.vb.h;
        }
        this.map.updateViewBox();
    }

    _setupListeners() {
        // Bind methods to preserve `this` context
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onWheel = this._onWheel.bind(this);

        this.svg.addEventListener('mousedown', this._onPointerDown);
        this.svg.addEventListener('mousemove', this._onPointerMove);
        this.svg.addEventListener('mouseup', this._onPointerUp);
        this.svg.addEventListener('mouseleave', this._onPointerUp);
        this.svg.addEventListener('touchstart', this._onPointerDown, { passive: false });
        this.svg.addEventListener('touchmove', this._onPointerMove, { passive: false });
        this.svg.addEventListener('touchend', this._onPointerUp);
        this.svg.addEventListener('touchcancel', this._onPointerUp);
        this.svg.addEventListener('wheel', this._onWheel, { passive: false });
    }

    destroy() {
        if (!this.svg) return;
        this.svg.removeEventListener('mousedown', this._onPointerDown);
        this.svg.removeEventListener('mousemove', this._onPointerMove);
        this.svg.removeEventListener('mouseup', this._onPointerUp);
        this.svg.removeEventListener('mouseleave', this._onPointerUp);
        this.svg.removeEventListener('touchstart', this._onPointerDown);
        this.svg.removeEventListener('touchmove', this._onPointerMove);
        this.svg.removeEventListener('touchend', this._onPointerUp);
        this.svg.removeEventListener('touchcancel', this._onPointerUp);
        this.svg.removeEventListener('wheel', this._onWheel);
    }
}

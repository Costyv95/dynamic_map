import { SVG_NS, buildScene, buildWalls, applyViewport, roomLabelCenter } from '../core/MapScene.js?v=3.2.1';
import { computeViewport, viewPointToMap, labelTransform, DEFAULT_FLIPS } from '../core/Viewport.js?v=3.2.1';
import { updateRoomStyles } from '../core/RoomStyles.js?v=3.2.1';
import { Camera } from '../core/Camera.js?v=3.2.1';
import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.1';
import { EditOverlay } from './EditOverlay.js?v=3.2.1';

/**
 * The editor's map: the card's own SVG scene (core/MapScene) inside an
 * <svg>, plus the EditOverlay on top. It is the scene host / mapContext
 * for the badges (non-interactive, live hass optional) and exposes the
 * per-floor view settings the sidebar edits: rotationMode, flips,
 * backgroundColor, backgroundMode, activeMode (the simulated layout being
 * edited) and linkOrientations.
 */
export class EditorCanvas {
    constructor(container, state) {
        this.container = container;
        this.state = state;
        this.svgNS = SVG_NS;
        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.classList.add('dm-editor-svg');
        this.svg.style.cssText = 'width: 100%; height: 100%; display: block; touch-action: none;';
        this.mapRoot = document.createElementNS(SVG_NS, 'g');
        this.mapRoot.id = 'map-root';
        this.overlay = new EditOverlay(SVG_NS);
        this.svg.appendChild(this.mapRoot);
        this.svg.appendChild(this.overlay.root);
        container.appendChild(this.svg);

        // Scene-host / mapContext fields read by MapScene and MapShortcut.
        this.interactive = false;
        this.skipUnchanged = false;
        this.rooms = []; this.walls = []; this.shortcuts = [];
        this.shortcutElements = {};
        this.imgW = 1000; this.imgH = 1000;
        this.bgUrl = '';
        this._hass = null;
        this.activeMode = 'horizontal';
        this.isRotated = false;
        this.rotationMode = 'auto';
        this.flips = DEFAULT_FLIPS();
        this.backgroundColor = null;
        this.backgroundMode = 'image';
        this.linkOrientations = true;
        this.vb = { x: 0, y: 0, w: 1000, h: 1000 };
        this.defaultVb = { ...this.vb };
        this.camera = new Camera(this.svg, this, { maxOut: 2.5 });
        if (typeof ResizeObserver === 'function') {
            this._resize = new ResizeObserver(() => this.layout());
            this._resize.observe(container);
        }
    }

    getActiveMode() { return this.activeMode; }
    isPointInPolygon(point, vs) { return MapGeometry.isPointInPolygon(point, vs); }
    get floorBgColor() { return this.backgroundColor; }
    get floorBgMode() { return this.backgroundMode; }

    setHass(hass) {
        this._hass = hass;
        this.refreshAll();
    }

    /** Load a floor: geometry from the state manager, background by URL. */
    loadFloor({ bgUrl, imgW, imgH, config }) {
        this.bgUrl = bgUrl;
        this.imgW = imgW || 1000;
        this.imgH = imgH || 1000;
        const c = config || {};
        this.rotationMode = c.rotation_mode || 'auto';
        this.flips = c.flips || DEFAULT_FLIPS();
        this.backgroundColor = c.background_color || null;
        this.backgroundMode = c.background_mode || 'image';
        this.rebuild();
    }

    /** Rebuild the whole scene from the state manager's arrays. */
    rebuild() {
        while (this.mapRoot.firstChild) this.mapRoot.removeChild(this.mapRoot.firstChild);
        this.rooms = this.state.rooms;
        this.walls = this.state.walls;
        this.shortcuts = this.state.shortcuts;
        this.wallsLayer = null;
        buildScene(this, { bgUrl: this.bgUrl });
        this._builtIds = this.shortcuts.map(s => s.id).join('|');
        this.layout();
    }

    /** Viewport for the simulated layout, then refresh. */
    layout() {
        const rect = this.container.getBoundingClientRect();
        const vp = computeViewport({
            rooms: this.state.rooms, imgW: this.imgW, imgH: this.imgH,
            screenW: rect.width, screenH: rect.height,
            rotationMode: this.activeMode === 'vertical' ? 'vertical' : 'horizontal', flips: this.flips
        });
        this.viewport = vp;
        this.isRotated = vp.isRotated;
        this.mapScaleX = vp.scaleX;
        this.mapScaleY = vp.scaleY;
        this.vb = { ...vp.vb };
        this.defaultVb = { ...vp.vb };
        this.updateViewBox();
        this.container.style.background = this.backgroundMode === 'fit' ? '' : (this.backgroundColor || '');
        this.refresh();
    }

    calculateAutoCrop() { this.layout(); }
    resizeCanvas() { this.layout(); }

    updateViewBox() {
        this.svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);
    }

    /** Screen pixels per map unit at the current zoom. */
    pxPerUnit() { return this.camera.scale(); }

    /** Client coordinates to map pixels (through the viewBox and the map transform). */
    clientToMap(clientX, clientY) {
        const v = this.camera.screenToView(clientX, clientY);
        return this.viewport ? viewPointToMap(this.viewport, v.x, v.y) : v;
    }

    /** Map pixels to percent of the floor image. */
    toPercent(x, y) { return [(x / this.imgW) * 100, (y / this.imgH) * 100]; }

    /**
     * Cheap update after an edit: room geometry, walls, badge positions,
     * the selected badge's look, layer dimming and the overlay. Falls back
     * to a rebuild when shortcuts were added or removed.
     */
    refresh() {
        if (!this.viewport) return;
        const ids = this.state.shortcuts.map(s => s.id).join('|');
        if (ids !== this._builtIds || this.state.rooms !== this.rooms || this.state.walls !== this.walls) {
            this.rebuild();
            return;
        }
        this.refreshRooms();
        this.refreshWalls();
        this.refreshShortcut(this.state.selectedShortcutIdx);
        this.applyLayerState();
        this.overlay.setTransform(this.viewport.transform);
        this.overlay.render({
            state: this.state, host: this, imgW: this.imgW, imgH: this.imgH,
            pxPerUnit: this.pxPerUnit(), vp: this.viewport, hass: this._hass
        });
    }

    refreshRooms() {
        const polys = this.mapRoot.querySelectorAll('polygon.room-polygon');
        polys.forEach((poly, idx) => {
            const room = this.rooms[idx];
            if (!room) return;
            poly.setAttribute('points', room.polygon.map(pt => `${(pt[0] / 100) * this.imgW},${(pt[1] / 100) * this.imgH}`).join(' '));
        });
        this.mapRoot.querySelectorAll('.room-label').forEach(label => {
            const room = this.rooms.find(r => String(r.id) === label.dataset.roomId);
            if (!room) return;
            const { cx, cy } = roomLabelCenter(this, room);
            label.setAttribute('x', cx);
            label.setAttribute('y', cy);
            label.textContent = room.name || '';
            label.rawCx = cx; label.rawCy = cy;
            const t = labelTransform(this.viewport, cx, cy);
            if (t) label.setAttribute('transform', t); else label.removeAttribute('transform');
        });
        this.focusedRoomId = null;
        updateRoomStyles(this);
        this.state.selectedRooms.forEach(i => {
            const p = polys[i];
            if (p) p.classList.add('dm-selected');
        });
    }

    refreshWalls() {
        if (this.wallsLayer) this.wallsLayer.remove();
        this.wallsLayer = null;
        buildWalls(this);
        if (this.wallsLayer && this.decorLayer) this.mapRoot.insertBefore(this.wallsLayer, this.decorLayer);
    }

    /** Re-render one badge (property edits, preview state) and reposition all. */
    refreshShortcut(idx) {
        const sc = this.state.shortcuts[idx];
        const obj = sc && this.shortcutElements[sc.id];
        if (obj) {
            const st = this.state.previewStateIdx !== -1 ? sc.config?.states?.[this.state.previewStateIdx] : null;
            obj.config = sc.config || {};
            obj.forcedState = st || null;
            obj.invalidate();
            obj.updateState(this._hass || {});
        }
        applyViewport(this, this.viewport);
    }

    /** Re-render every badge (hass changed, floor settings changed). */
    refreshAll() {
        Object.values(this.shortcutElements).forEach(obj => {
            obj.forcedState = null;
            obj.invalidate();
            obj.updateState(this._hass || {});
        });
        this.refresh();
    }

    /** Dim layers other than the active one and make only it clickable. */
    applyLayerState() {
        const active = this.state.activeLayer || 'objects';
        const editing = this.state.isEditMode;
        Object.values(this.shortcutElements).forEach(obj => {
            const layer = (obj.sc.config && obj.sc.config.decor) ? 'decor' : 'objects';
            const on = layer === active;
            obj.group.style.opacity = (editing && !on) ? '0.35' : '';
            obj.group.style.pointerEvents = on ? 'all' : 'none';
        });
        if (this.wallsLayer) {
            const on = active === 'walls';
            this.wallsLayer.style.opacity = (editing && !on) ? '0.35' : '';
            this.wallsLayer.style.pointerEvents = on ? 'all' : 'none';
            this.wallsLayer.querySelectorAll('path').forEach(p => { p.style.cursor = 'pointer'; });
        }
        this.mapRoot.querySelectorAll('polygon.room-polygon').forEach(p => {
            p.style.cursor = active === 'walls' ? 'crosshair' : 'pointer';
        });
    }

    destroy() {
        if (this._resize) this._resize.disconnect();
        this.camera.destroy();
        this.svg.remove();
    }
}

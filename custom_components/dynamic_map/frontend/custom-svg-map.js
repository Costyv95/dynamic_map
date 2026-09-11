import { CameraManager } from './card/CameraManager.js?v=3.2.1';
import { MapBuilder } from './card/MapBuilder.js?v=3.2.1';
import { CARD_STYLES } from './card/CardStyles.js?v=3.2.1';
import { computeViewport, mapPointToView, DEFAULT_FLIPS } from './core/Viewport.js?v=3.2.1';
import { SVG_NS, buildScene, applyViewport } from './core/MapScene.js?v=3.2.1';
import { roomIsOn } from './core/RoomStyles.js?v=3.2.1';
import { buildAmbientTint } from './card/AmbientTint.js?v=3.2.1';
import { buildPresenceLayer, animatePresence } from './card/PresenceLayer.js?v=3.2.1';
import { buildOutsideBar } from './card/OutsideBar.js?v=3.2.1';
import { buildFocusPill } from './card/RoomFocus.js?v=3.2.1';
import { cardDelegates } from './card/CardDelegates.js?v=3.2.1';
import { buildRoomPanelEl, updateRoomPanel, hideRoomPanel } from './card/RoomPanel.js?v=3.2.1';

/**
 * The Lovelace card. It is the scene host for core/MapScene and the
 * mapContext for every MapShortcut; the heavy lifting lives in core/ and
 * card/ modules that build into this element.
 */
class CustomSvgMap extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.svgNS = SVG_NS;
        const style = document.createElement('style');
        style.textContent = CARD_STYLES;
        this.shadowRoot.appendChild(style);

        this.rooms = [];
        this.shortcuts = [];
        this.walls = [];
        this.lastTime = 0;
        this.focusedRoomId = null;
        this.rotationMode = 'auto';
        this.activeOverlay = null;
        this.skipUnchanged = true;
        this._loadSeq = 0;
        this._vbAnimFrame = null;

        this.renderRoot = document.createElement('div');
        this.renderRoot.className = 'dm-render-root';
        this.shadowRoot.appendChild(this.renderRoot);
        this.animationFrame = null;
    }

    connectedCallback() {
        if (!this.resizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                if (this.rooms && this.rooms.length > 0 && this.imgW && this.imgH) this.calculateAutoCrop();
            });
            this.resizeObserver.observe(this);
        }
    }

    disconnectedCallback() {
        if (this.resizeObserver) { this.resizeObserver.disconnect(); this.resizeObserver = null; }
        if (this.cameraManager) { this.cameraManager.destroy(); this.cameraManager = null; }
        if (this.animationFrame) { cancelAnimationFrame(this.animationFrame); this.animationFrame = null; }
    }

    static getStubConfig() {
        return { type: 'custom:custom-svg-map', default_floor: 1 };
    }

    setConfig(config) {
        this.config = { ...config };
        if (this.config.floors && this.config.floors.length) {
            this.activeFloor = this.config.default_floor || this.config.floor || this.config.floors[0];
            this.loadData();
        } else {
            // No floors configured: discover them once hass is available.
            this._needsFloorDiscovery = true;
        }
    }

    async discoverFloors(hass) {
        this._needsFloorDiscovery = false;
        let floors = [1];
        try {
            const data = await hass.callApi('GET', 'dynamic_map/floors');
            if (data && data.floors && data.floors.length) floors = data.floors;
            if (data && data.names) this._floorNames = data.names;
        } catch (e) {
            console.warn('[custom-svg-map] Floor discovery failed, defaulting to floor 1', e);
        }
        this.config.floors = floors;
        const preferred = this.config.default_floor || this.config.floor;
        this.activeFloor = floors.includes(preferred) ? preferred : floors[0];
        this.loadData();
    }

    floorLabel(floorNum) {
        const names = this.config.floor_names || {};
        const stored = this._floorNames || {};
        return names[floorNum] || stored[String(floorNum)] || `Floor ${floorNum}`;
    }

    loadFloorNames(hass) { return MapBuilder.loadFloorNames(this, hass); }

    async loadData() {
        const floor = this.activeFloor;
        const requestId = ++this._loadSeq;
        const t = Date.now();
        const bgUrl = `/dynamic_map_data/bg_floor${floor}.png?t=${t}`;
        const fetchJson = async (url) => {
            try {
                const res = await fetch(url);
                return res.ok ? await res.json() : null;
            } catch (e) { return null; }
        };
        try {
            const [rooms, shortcuts, config, outside] = await Promise.all([
                fetchJson(`/dynamic_map_data/rooms_floor${floor}.json?t=${t}`),
                fetchJson(`/dynamic_map_data/shortcuts_floor${floor}.json?t=${t}`),
                fetchJson(`/dynamic_map_data/config_floor${floor}.json?t=${t}`),
                fetchJson(`/dynamic_map_data/outside.json?t=${t}`)
            ]);
            if (requestId !== this._loadSeq) return; // superseded by a newer floor switch
            this.rooms = rooms || [];
            this.shortcuts = shortcuts || [];
            this.outsideItems = outside || [];
            const floorConfig = config || { rotation_mode: 'auto' };
            this.rotationMode = floorConfig.rotation_mode || 'auto';
            this.floorBgColor = floorConfig.background_color || null;
            this.floorBgMode = floorConfig.background_mode || 'image';
            this.walls = floorConfig.walls || [];
            this.flips = floorConfig.flips || DEFAULT_FLIPS();

            const img = new Image();
            const ready = (w, h) => {
                if (requestId !== this._loadSeq) return;
                this.imgW = w; this.imgH = h;
                this.buildSVG(bgUrl);
            };
            img.onload = () => ready(img.naturalWidth || 1000, img.naturalHeight || 1000);
            img.onerror = () => ready(1000, 1000);
            img.src = bgUrl;
        } catch (e) {
            console.error('Failed to load map data', e);
            this.renderRoot.innerHTML = `<div class="dm-error">Failed to load map data. Ensure rooms_floor${floor}.json exists in /config/dynamic_map_data/.</div>`;
        }
    }

    buildSVG(bgUrl) {
        this.renderRoot.innerHTML = '';
        this.focusedRoomId = null;
        this.mapWrapper = document.createElement('div');
        this.mapWrapper.style.cssText = 'position: relative; margin: 0 auto; display: block; width: 100%; height: 100%;';
        this.svg = document.createElementNS(this.svgNS, 'svg');
        this.svg.style.cssText = 'width: 100%; height: 100%; display: block;';
        this.mapRoot = document.createElementNS(this.svgNS, 'g');
        this.mapRoot.id = 'map-root';

        this.applyFloorBackground();
        buildScene(this, { bgUrl, onRoomTap: (room) => this.onRoomTap(room) });
        this.updateRoomStyles();
        buildAmbientTint(this);
        buildPresenceLayer(this);

        this.svg.appendChild(this.mapRoot);
        this.mapWrapper.appendChild(this.svg);
        this.renderRoot.appendChild(this.mapWrapper);
        // Clicking the background (not a room or a shortcut) exits room focus.
        this.svg.addEventListener('click', (e) => {
            if (this._cameraDragged) return;
            const t = e.target;
            if (t && t.closest && t.closest('.room-polygon, .shortcut-group')) return;
            if (this.focusedRoomId) this.zoomOutToDefault();
        });
        this.calculateAutoCrop();

        this.topLeftUI = document.createElement('div');
        this.topLeftUI.className = 'dm-top-ui';
        this.renderRoot.appendChild(this.topLeftUI);
        const floorSwitcher = MapBuilder.buildFloorSwitcher(this);
        if (floorSwitcher) this.topLeftUI.appendChild(floorSwitcher);
        this.topLeftUI.appendChild(MapBuilder.buildRotationSwitcher(this));
        buildFocusPill(this);
        buildOutsideBar(this);
        buildRoomPanelEl(this);

        if (this.cameraManager) this.cameraManager.destroy();
        this.cameraManager = new CameraManager(this.svg, this);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.lastTime = performance.now();
        this.animate(this.lastTime);
    }

    /** Paint the letterbox around the map in the floor colour ('fit' keeps the card surface). */
    applyFloorBackground() {
        const paint = this.floorBgMode === 'fit' ? null : this.floorBgColor;
        if (this.renderRoot) this.renderRoot.style.background = paint || '';
    }

    /** Map a point from image coordinates into viewBox space (flips, then rotation). */
    mapPointToView(px, py) {
        const c = this.transformCenter;
        if (!c) return { x: px, y: py };
        return mapPointToView({
            cx: c.cx, cy: c.cy, isRotated: !!this.isRotated,
            scaleX: this.mapScaleX || 1, scaleY: this.mapScaleY || 1
        }, px, py);
    }

    /** Called by CameraManager when the user starts a manual pan/pinch/wheel. */
    onManualCameraStart() {
        if (this._vbAnimFrame) { cancelAnimationFrame(this._vbAnimFrame); this._vbAnimFrame = null; }
    }

    /** Called by CameraManager when a manual zoom snaps back to the full view. */
    onCameraReset() {
        if (this.focusedRoomId) {
            this.focusedRoomId = null;
            this.updateRoomStyles();
            this.syncFocusPill();
        }
    }

    calculateAutoCrop() {
        this.focusedRoomId = null;
        this.syncFocusPill();
        hideRoomPanel(this);
        const rect = this.getBoundingClientRect();
        const vp = computeViewport({
            rooms: this.rooms, imgW: this.imgW, imgH: this.imgH,
            screenW: rect.width, screenH: rect.height,
            rotationMode: this.rotationMode, flips: this.flips
        });
        this.viewport = vp;
        this.isRotated = vp.isRotated;
        this.activeMode = vp.activeMode;
        this.mapScaleX = vp.scaleX;
        this.mapScaleY = vp.scaleY;
        this.transformCenter = { cx: vp.cx, cy: vp.cy };
        if (this.rooms.length) applyViewport(this, vp);
        this.vb = { ...vp.vb };
        this.defaultVb = { ...vp.vb };
        this.updateViewBox();
        // Shortcut layouts resolve per-orientation props at render time:
        // when the mode flips, rebuild them now instead of waiting for the
        // next hass tick.
        if (this._lastAppliedMode !== this.activeMode && this.shortcutElements && this._hass) {
            for (const id in this.shortcutElements) this.shortcutElements[id].updateState(this._hass);
            this.applyShortcutTransforms(this.isRotated ? vp.scaleX : 1, this.isRotated ? vp.scaleY : 1);
        }
        this._lastAppliedMode = this.activeMode;
    }

    updateViewBox() {
        if (!this.svg) return;
        this.svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);
    }

    set hass(hass) {
        const prev = this._hass;
        this._hass = hass;
        if (this._needsFloorDiscovery) { this.discoverFloors(hass); return; }
        if (!this._floorNamesRequested && hass.callApi) { this._floorNamesRequested = true; this.loadFloorNames(hass); }
        let anyChanged = false;
        for (const id in this.shortcutElements) {
            if (this.shortcutElements[id].updateState(hass)) anyChanged = true;
        }
        if (this.shortcutElements && anyChanged) {
            const sX = this.mapScaleX !== undefined ? this.mapScaleX : 1;
            const sY = this.mapScaleY !== undefined ? this.mapScaleY : 1;
            this.applyShortcutTransforms(this.isRotated ? sX : 1, this.isRotated ? sY : 1);
        }
        // Room fills track their light entity: restyle when any flipped.
        const roomsChanged = this.rooms.some(r => r.entity_id && roomIsOn(r, prev) !== roomIsOn(r, hass));
        if (roomsChanged || !this._initialStylesRendered) {
            this.updateRoomStyles();
            this._initialStylesRendered = true;
        }
        this.updateOutsideBar(hass);
        this.updateAmbientTint(hass);
        this.updatePresence(hass);
        updateRoomPanel(this, hass);
    }

    animate(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        for (const id in this.shortcutElements) {
            const obj = this.shortcutElements[id];
            if (obj.animate) obj.animate(deltaTime);
        }
        animatePresence(this, deltaTime);
        this.animationFrame = requestAnimationFrame((t) => this.animate(t));
    }

}

Object.assign(CustomSvgMap.prototype, cardDelegates);

if (!customElements.get('custom-svg-map')) {
    customElements.define('custom-svg-map', CustomSvgMap);
}

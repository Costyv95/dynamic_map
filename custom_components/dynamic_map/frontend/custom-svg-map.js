import { CameraManager } from './card/CameraManager.js?v=3.2.1';
import { MapBuilder } from './card/MapBuilder.js?v=3.2.1';
import { CARD_STYLES } from './card/CardStyles.js?v=3.2.1';
import { mapPointToView } from './core/Viewport.js?v=3.2.1';
import { SVG_NS, buildScene } from './core/MapScene.js?v=3.2.1';
import { roomIsOn } from './core/RoomStyles.js?v=3.2.1';
import { buildAmbientTint } from './card/AmbientTint.js?v=3.2.1';
import { buildPresenceLayer, animatePresence } from './card/PresenceLayer.js?v=3.2.1';
import { buildOutsideBar } from './card/OutsideBar.js?v=3.2.1';
import { buildFocusPill } from './card/RoomFocus.js?v=3.2.1';
import { cardDelegates } from './card/CardDelegates.js?v=3.2.1';
import { buildRoomPanelEl } from './card/RoomPanel.js?v=3.2.1';
import { buildQuickActions } from './card/QuickActions.js?v=3.2.1';
import { tintSignature } from './card/RoomTemperature.js?v=3.2.1';
import { buildRoomAlerts } from './card/RoomAlerts.js?v=3.2.1';
import { discoverFloors, floorLabel, loadData } from './card/FloorData.js?v=3.2.1';
import { applyAutoCrop } from './card/CardViewport.js?v=3.2.1';
import { buildTempLegend } from './card/TempLegend.js?v=3.2.1';

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

    discoverFloors(hass) { return discoverFloors(this, hass); }
    floorLabel(floorNum) { return floorLabel(this, floorNum); }
    loadData() { return loadData(this); }
    /** Fit the rooms into the card, rotating/flipping per the floor config. */
    calculateAutoCrop() { applyAutoCrop(this); }

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
        buildRoomAlerts(this);

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
        buildQuickActions(this);
        buildTempLegend(this);

        if (this.cameraManager) this.cameraManager.destroy();
        this.cameraManager = new CameraManager(this.svg, this);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.lastTime = performance.now();
        this.animate(this.lastTime);
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
        // Room fills track their light entity and temperature: restyle when either changed.
        const tints = tintSignature(this, hass);
        const roomsChanged = tints !== this._tintSig || this.rooms.some(r => r.entity_id && roomIsOn(r, prev) !== roomIsOn(r, hass));
        this._tintSig = tints;
        if (roomsChanged || !this._initialStylesRendered) {
            this.updateRoomStyles();
            this._initialStylesRendered = true;
        }
        this.updateLiveFeatures(hass);
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

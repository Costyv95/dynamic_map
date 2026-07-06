import { ShortcutFactory } from './shortcuts/ShortcutFactory.js?v=3.1.0';
import { CameraManager } from './card/CameraManager.js?v=3.1.0';
import { MapGeometry } from './shared/MapGeometry.js?v=3.1.0';
import { OverlayManager } from './card/OverlayManager.js?v=3.1.0';
import { MapBuilder } from './card/MapBuilder.js?v=3.1.0';

const CARD_STYLES = `
    :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 70vh; /* Fallback for non-panel views */
        position: relative;
        /* Theme tokens with HA theme fallbacks — override via HA themes */
        --dm-accent: var(--primary-color, #0ea5e9);
        --dm-surface: var(--card-background-color, #ffffff);
        --dm-text: var(--primary-text-color, #1e293b);
        --dm-muted: var(--secondary-text-color, #64748b);
        --dm-border: var(--divider-color, #e2e8f0);
        --dm-chip-bg: var(--ha-card-background, var(--card-background-color, #ffffff));
        --dm-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
        font-family: var(--primary-font-family, var(--paper-font-body1_-_font-family, Roboto, sans-serif));
    }
    .dm-render-root {
        position: absolute;
        inset: 0;
        background: var(--dm-surface);
        overflow: hidden;
    }
    .dm-top-ui {
        position: absolute;
        top: 12px;
        left: 12px;
        display: flex;
        gap: 8px;
        align-items: flex-start;
        z-index: 10;
    }
    .dm-chip-group {
        display: flex;
        flex-direction: column;
        background: var(--dm-chip-bg);
        border: 1px solid var(--dm-border);
        border-radius: 10px;
        overflow: hidden;
        box-shadow: var(--dm-shadow);
    }
    .dm-chip {
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 600;
        color: var(--dm-text);
        cursor: pointer;
        border-bottom: 1px solid var(--dm-border);
        transition: background 0.15s ease, color 0.15s ease;
        user-select: none;
        text-align: center;
    }
    .dm-chip:last-child { border-bottom: none; }
    .dm-chip:hover:not(.active) { background: rgba(127, 127, 127, 0.12); }
    .dm-chip.active { background: var(--dm-accent); color: #fff; }
    .dm-icon-btn {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--dm-chip-bg);
        border: 1px solid var(--dm-border);
        border-radius: 10px;
        cursor: pointer;
        color: var(--dm-text);
        box-shadow: var(--dm-shadow);
        transition: background 0.15s ease;
        padding: 0;
    }
    .dm-icon-btn:hover { background: rgba(127, 127, 127, 0.12); }
    .room-polygon {
        cursor: pointer;
        transition: fill 0.25s ease, stroke 0.25s ease, filter 0.25s ease;
    }
    .room-polygon.dm-on { filter: drop-shadow(0 0 8px var(--dm-room-glow, transparent)); }
    .room-polygon.dm-selected { filter: drop-shadow(0 0 6px var(--dm-accent)); }
    .room-polygon:hover:not(.dm-selected):not(.dm-on) { filter: brightness(1.15); }
    .room-label {
        pointer-events: none;
        user-select: none;
        paint-order: stroke;
        stroke: rgba(0, 0, 0, 0.55);
        stroke-width: 3px;
        stroke-linejoin: round;
    }
    .dm-error { color: var(--error-color, #ef4444); padding: 20px; font-size: 14px; }
`;

class CustomSvgMap extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.svgNS = "http://www.w3.org/2000/svg";

        const style = document.createElement('style');
        style.textContent = CARD_STYLES;
        this.shadowRoot.appendChild(style);

        this.rooms = [];
        this.shortcuts = [];
        this.lastTime = 0;
        this.selectedRoomId = null;
        this.rotationMode = 'auto';
        this.activeOverlay = null;
        this._loadSeq = 0;

        this.renderRoot = document.createElement('div');
        this.renderRoot.className = 'dm-render-root';
        this.shadowRoot.appendChild(this.renderRoot);
        this.animationFrame = null;
    }

    connectedCallback() {
        if (!this.resizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                if (this.rooms && this.rooms.length > 0 && this.imgW && this.imgH) {
                    this.calculateAutoCrop();
                }
            });
            this.resizeObserver.observe(this);
        }
    }

    disconnectedCallback() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.cameraManager) {
            this.cameraManager.destroy();
            this.cameraManager = null;
        }
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
            // No floors configured: discover them from the backend once hass is available.
            this._needsFloorDiscovery = true;
        }
    }

    async discoverFloors(hass) {
        this._needsFloorDiscovery = false;
        let floors = [1];
        try {
            const data = await hass.callApi('GET', 'dynamic_map/floors');
            if (data && data.floors && data.floors.length) floors = data.floors;
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
        return names[floorNum] || `Floor ${floorNum}`;
    }

    async loadData() {
        const floor = this.activeFloor;
        const requestId = ++this._loadSeq;
        const t = Date.now();
        const bgUrl = `/dynamic_map_data/bg_floor${floor}.png?t=${t}`;

        const fetchJson = async (url) => {
            try {
                const res = await fetch(url);
                return res.ok ? await res.json() : null;
            } catch (e) {
                return null;
            }
        };

        try {
            const [rooms, shortcuts, config] = await Promise.all([
                fetchJson(`/dynamic_map_data/rooms_floor${floor}.json?t=${t}`),
                fetchJson(`/dynamic_map_data/shortcuts_floor${floor}.json?t=${t}`),
                fetchJson(`/dynamic_map_data/config_floor${floor}.json?t=${t}`)
            ]);
            // A newer floor switch superseded this load — drop it.
            if (requestId !== this._loadSeq) return;

            this.rooms = rooms || [];
            this.shortcuts = shortcuts || [];

            const floorConfig = config || { rotation_mode: 'auto' };
            this.rotationMode = floorConfig.rotation_mode || 'auto';
            this.flips = floorConfig.flips || {
                horizontal: { h: false, v: false },
                vertical: { h: false, v: false }
            };

            const img = new Image();
            img.onload = () => {
                if (requestId !== this._loadSeq) return;
                this.imgW = img.naturalWidth || 1000;
                this.imgH = img.naturalHeight || 1000;
                this.buildSVG(bgUrl);
            };
            img.onerror = () => {
                if (requestId !== this._loadSeq) return;
                this.imgW = 1000;
                this.imgH = 1000;
                this.buildSVG(bgUrl);
            };
            img.src = bgUrl;

        } catch (e) {
            console.error("Failed to load map data", e);
            this.renderRoot.innerHTML = `<div class="dm-error">Failed to load map data. Ensure rooms_floor${floor}.json exists in /config/dynamic_map_data/.</div>`;
        }
    }

    buildFloorSwitcher() {
        const switcher = MapBuilder.buildFloorSwitcher(this);
        if (switcher && this.topLeftUI) {
            this.topLeftUI.appendChild(switcher);
        }
    }

    buildRotationSwitcher() {
        const switcher = MapBuilder.buildRotationSwitcher(this);
        if (switcher && this.topLeftUI) {
            this.topLeftUI.appendChild(switcher);
        }
    }

    buildSVG(bgUrl) {
        this.renderRoot.innerHTML = '';

        // mapWrapper will strictly confine the SVG and overlay UI
        this.mapWrapper = document.createElement('div');
        this.mapWrapper.style.position = 'relative';
        this.mapWrapper.style.margin = '0 auto';
        this.mapWrapper.style.display = 'block';

        this.svg = document.createElementNS(this.svgNS, 'svg');
        this.svg.style.width = '100%';
        this.svg.style.height = '100%';
        this.svg.style.display = 'block';

        this.mapRoot = document.createElementNS(this.svgNS, 'g');
        this.mapRoot.id = 'map-root';

        const image = document.createElementNS(this.svgNS, 'image');
        image.setAttribute('href', bgUrl);
        image.setAttribute('width', this.imgW.toString());
        image.setAttribute('height', this.imgH.toString());
        image.setAttribute('preserveAspectRatio', 'none');
        this.mapRoot.appendChild(image);

        this.rooms.forEach(room => {
            const polygon = document.createElementNS(this.svgNS, 'polygon');
            const pointsStr = room.polygon.map(pt => {
                const px = (pt[0] / 100) * this.imgW;
                const py = (pt[1] / 100) * this.imgH;
                return `${px},${py}`;
            }).join(' ');
            polygon.setAttribute('points', pointsStr);
            polygon.setAttribute('stroke-width', (this.imgW * 0.002).toString());

            if (room.name) {
                const { cx, cy } = this.getRoomLabelCenter(room);
                const text = document.createElementNS(this.svgNS, 'text');
                text.setAttribute('x', cx);
                text.setAttribute('y', cy);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'central');
                text.setAttribute('font-size', (this.imgW * 0.02).toString());
                text.setAttribute('fill', 'white');
                text.setAttribute('font-weight', 'bold');
                text.textContent = room.name;
                text.classList.add('room-label');

                // Save raw center for counter-rotation later
                text.rawCx = cx;
                text.rawCy = cy;
                this.mapRoot.appendChild(text);
            }

            polygon.classList.add('room-polygon');

            polygon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onRoomTap(room);
            });

            this.mapRoot.insertBefore(polygon, this.mapRoot.lastChild);
        });

        this.updateRoomStyles();

        this.shortcutElements = {};
        this.shortcuts.forEach(sc => {
            const shortcutObj = ShortcutFactory.create(sc, this.svgNS, this.imgW, this.imgH, this);
            this.shortcutElements[sc.id] = shortcutObj;
            this.mapRoot.appendChild(shortcutObj.render());

            if (this._hass) {
                shortcutObj.updateState(this._hass);
            }
        });

        this.svg.appendChild(this.mapRoot);
        this.mapWrapper.appendChild(this.svg);
        this.renderRoot.appendChild(this.mapWrapper);

        // Calculate geometry and rotation
        this.calculateAutoCrop();

        // Top-left UI container for overlay controls
        this.topLeftUI = document.createElement('div');
        this.topLeftUI.className = 'dm-top-ui';
        this.renderRoot.appendChild(this.topLeftUI);

        this.buildFloorSwitcher();
        this.buildRotationSwitcher();

        if (this.cameraManager) this.cameraManager.destroy();
        this.cameraManager = new CameraManager(this.svg, this);

        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.lastTime = performance.now();
        this.animate(this.lastTime);
    }

    getRoomLabelCenter(room) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        room.polygon.forEach(pt => {
            const px = (pt[0] / 100) * this.imgW;
            const py = (pt[1] / 100) * this.imgH;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        });
        return { cx: minX + (maxX - minX) / 2, cy: minY + (maxY - minY) / 2 };
    }

    /**
     * Room tap behavior, configurable via card config `room_tap_action` and
     * per-room `tap_action`: 'toggle' | 'area_toggle' | 'more-info' | 'none'.
     * Default 'toggle': toggles the room's entity, falling back to toggling
     * the lights of its linked HA area.
     */
    onRoomTap(room) {
        // Multi-select mode (e.g. picking rooms for vacuum cleaning)
        if (this.isSelectingRooms) {
            if (this.selectedRoomIds.includes(room.id)) {
                this.selectedRoomIds = this.selectedRoomIds.filter(id => id !== room.id);
            } else {
                this.selectedRoomIds.push(room.id);
            }
            this.updateRoomStyles();
            return;
        }

        this.selectedRoomId = (this.selectedRoomId === room.id) ? null : room.id;
        this.updateRoomStyles();

        if (!this._hass) return;
        const action = room.tap_action || this.config.room_tap_action || 'toggle';

        switch (action) {
            case 'none':
                return;
            case 'more-info': {
                const entityId = room.entity_id;
                if (entityId) {
                    this.dispatchEvent(new CustomEvent('hass-more-info', {
                        detail: { entityId }, bubbles: true, composed: true
                    }));
                }
                return;
            }
            case 'area_toggle':
                if (room.area_id) {
                    this._hass.callService('light', 'toggle', {}, { area_id: room.area_id });
                }
                return;
            case 'toggle':
            default:
                if (room.entity_id) {
                    const domain = room.entity_id.split('.')[0];
                    this._hass.callService(domain, 'toggle', { entity_id: room.entity_id });
                } else if (room.area_id) {
                    this._hass.callService('light', 'toggle', {}, { area_id: room.area_id });
                }
        }
    }

    calculateAutoCrop() {
        this.isRotated = false;

        if (this.rooms.length === 0) {
            this.vb = { x: 0, y: 0, w: this.imgW, h: this.imgH };
            this.defaultVb = { ...this.vb };
            this.updateViewBox();
            return;
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.rooms.forEach(r => {
            r.polygon.forEach(pt => {
                const px = (pt[0] / 100) * this.imgW;
                const py = (pt[1] / 100) * this.imgH;
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
            });
        });

        const w = maxX - minX;
        const h = maxY - minY;
        const padX = w * 0.15;
        const padY = h * 0.15;

        let targetW = w + (padX * 2);
        let targetH = h + (padY * 2);
        const cx = minX + w / 2;
        const cy = minY + h / 2;

        const rect = this.getBoundingClientRect();
        const screenW = rect.width > 0 ? rect.width : 1;
        const screenH = rect.height > 0 ? rect.height : 1;
        const screenRatio = screenW / screenH;

        let shouldRotate = false;
        const isScreenLandscape = screenRatio > 1;
        const isMapLandscape = targetW > targetH;

        if (this.rotationMode === 'auto') {
            shouldRotate = isScreenLandscape !== isMapLandscape;
        } else if (this.rotationMode === 'horizontal') {
            shouldRotate = !isMapLandscape;
        } else if (this.rotationMode === 'vertical') {
            shouldRotate = isMapLandscape;
        }

        this.isRotated = shouldRotate;

        let scaleX = 1;
        let scaleY = 1;
        const finalIsHorizontal = isMapLandscape !== this.isRotated;
        const activeMode = finalIsHorizontal ? 'horizontal' : 'vertical';
        this.activeMode = activeMode;

        const currentFlips = this.flips[activeMode];
        if (this.isRotated) {
            if (currentFlips.h) scaleY = -1;
            if (currentFlips.v) scaleX = -1;
        } else {
            if (currentFlips.h) scaleX = -1;
            if (currentFlips.v) scaleY = -1;
        }

        this.mapScaleX = scaleX;
        this.mapScaleY = scaleY;

        let transformStr = '';
        if (this.isRotated) transformStr += `rotate(90, ${cx}, ${cy}) `;
        if (scaleX !== 1 || scaleY !== 1) transformStr += `translate(${cx}, ${cy}) scale(${scaleX}, ${scaleY}) translate(${-cx}, ${-cy})`;

        if (transformStr.trim()) {
            this.mapRoot.setAttribute('transform', transformStr.trim());

            this.mapRoot.querySelectorAll('.room-label').forEach(label => {
                let childTransformStr = `translate(${label.rawCx}, ${label.rawCy}) `;
                if (scaleX !== 1 || scaleY !== 1) childTransformStr += `scale(${scaleX}, ${scaleY}) `;
                if (this.isRotated) childTransformStr += `rotate(-90) `;
                childTransformStr += `translate(${-label.rawCx}, ${-label.rawCy})`;

                label.setAttribute('transform', childTransformStr);
            });
            this.applyShortcutTransforms(scaleX, scaleY);

            // Content rotated, swap target dimensions
            if (this.isRotated) {
                const temp = targetW;
                targetW = targetH;
                targetH = temp;
            }
        } else {
            this.mapRoot.removeAttribute('transform');
            this.mapRoot.querySelectorAll('.room-label').forEach(label => {
                label.removeAttribute('transform');
            });
            this.applyShortcutTransforms(1, 1);
        }

        const targetRatio = targetW / targetH;
        let finalW = targetW;
        let finalH = targetH;

        // Expand viewBox to perfectly match screen aspect ratio
        if (targetRatio < screenRatio) {
            finalW = targetH * screenRatio;
        } else {
            finalH = targetW / screenRatio;
        }

        this.vb = {
            x: cx - finalW/2,
            y: cy - finalH/2,
            w: finalW,
            h: finalH
        };

        this.defaultVb = { ...this.vb };
        this.updateViewBox();
    }

    /** Apply per-shortcut counter-transforms for the current rotation/flip state. */
    applyShortcutTransforms(scaleX, scaleY) {
        if (!this.shortcutElements) return;
        const flipped = scaleX !== 1 || scaleY !== 1;
        Object.values(this.shortcutElements).forEach(scObj => {
            const isAutoRotate = scObj.getIsAutoRotateActive && scObj.getIsAutoRotateActive();
            let scTransformStr = '';
            if (flipped) scTransformStr += `scale(${scaleX}, ${scaleY}) `;
            if (this.isRotated && !isAutoRotate) scTransformStr += `rotate(-90) `;
            if (scObj.setTransformStr) scObj.setTransformStr(scTransformStr.trim());
            else if (scObj.setRotation) scObj.setRotation((this.isRotated && !isAutoRotate) ? -90 : 0);

            if (scObj.updateCoordinates) {
                scObj.updateCoordinates();
            }
        });
    }

    updateViewBox() {
        if (!this.svg) return;
        this.svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);

        if (this.mapWrapper) {
            this.mapWrapper.style.width = '100%';
            this.mapWrapper.style.height = '100%';
        }
    }

    set hass(hass) {
        this._hass = hass;

        if (this._needsFloorDiscovery) {
            this.discoverFloors(hass);
            return;
        }

        let needsStyleUpdate = false;
        for (const id in this.shortcutElements) {
            const sc = this.shortcutElements[id];
            const changed = sc.updateState(hass);
            // If the shortcut represents a room light and it changed state, we need to update room styles
            if (changed && sc.sc.type === 'light') {
                needsStyleUpdate = true;
            }
        }

        // Re-apply shortcut transforms in case their active autoRotate state changed
        if (this.shortcutElements) {
            const sX = this.mapScaleX !== undefined ? this.mapScaleX : 1;
            const sY = this.mapScaleY !== undefined ? this.mapScaleY : 1;
            this.applyShortcutTransforms(this.isRotated ? sX : 1, this.isRotated ? sY : 1);
        }

        // Only update room styles if something actually changed, or on first load
        if (needsStyleUpdate || !this._initialStylesRendered) {
            this.updateRoomStyles();
            this._initialStylesRendered = true;
        }
    }

    updateRoomStyles() {
        if (!this.mapRoot) return;
        const polygons = this.mapRoot.querySelectorAll('polygon.room-polygon');
        polygons.forEach((poly, idx) => {
            const room = this.rooms[idx];
            if (!room) return;

            const isSelected = (this.selectedRoomId === room.id);
            // Golden-angle hue spread gives distinct auto-colors per room index
            const hue = (idx * 137.5) % 360;
            const rgb = MapGeometry.hexToRgb(room.color);
            const baseColor = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : null;
            const solid = baseColor ? `rgb(${baseColor})` : `hsl(${hue}, 100%, 50%)`;
            const fillAt = (a) => baseColor ? `rgba(${baseColor}, ${a})` : `hsla(${hue}, 100%, 50%, ${a})`;

            let isOn = false;
            if (room.entity_id && this._hass) {
                const stateObj = this._hass.states[room.entity_id];
                if (stateObj && stateObj.state === 'on') isOn = true;
            }

            poly.classList.remove('dm-selected', 'dm-on');
            poly.style.removeProperty('--dm-room-glow');

            if (this.isSelectingRooms) {
                if (this.selectedRoomIds && this.selectedRoomIds.includes(room.id)) {
                    poly.setAttribute('fill', fillAt(0.8));
                    poly.setAttribute('stroke', '#10b981');
                    poly.style.setProperty('--dm-room-glow', '#10b981');
                    poly.classList.add('dm-on');
                } else {
                    poly.setAttribute('fill', 'rgba(0,0,0,0.4)');
                    poly.setAttribute('stroke', 'rgba(255,255,255,0.2)');
                }
                return;
            }

            if (isSelected) {
                poly.setAttribute('fill', fillAt(0.7));
                poly.setAttribute('stroke', 'var(--dm-accent)');
                poly.classList.add('dm-selected');
            } else if (isOn) {
                poly.setAttribute('fill', fillAt(0.7));
                poly.setAttribute('stroke', solid);
                poly.style.setProperty('--dm-room-glow', solid);
                poly.classList.add('dm-on');
            } else {
                poly.setAttribute('fill', fillAt(0.35));
                poly.setAttribute('stroke', fillAt(0.9));
            }
        });
    }

    animate(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        for (const id in this.shortcutElements) {
            const obj = this.shortcutElements[id];
            if (obj.animate) {
                obj.animate(deltaTime);
            }
        }

        this.animationFrame = requestAnimationFrame((t) => this.animate(t));
    }

    getPolygonCenter(polygon) {
        return MapGeometry.getPolygonCenter(polygon);
    }

    isPointInPolygon(point, vs) {
        return MapGeometry.isPointInPolygon(point, vs);
    }

    getRandomPointInPolygon(polygon) {
        return MapGeometry.getRandomPointInPolygon(polygon);
    }

    showOverlay(shortcut, actions, event) {
        OverlayManager.showActionMenu(this, shortcut, actions, event);
    }

    showRoomSelectionUI() {
        OverlayManager.showRoomSelectionUI(this);
    }

    getCardSize() { return 3; }
}

if (!customElements.get('custom-svg-map')) {
    customElements.define('custom-svg-map', CustomSvgMap);
}

import { ShortcutFactory } from './shortcuts/ShortcutFactory.js';
import { CameraManager } from './CameraManager.js';
import { MapGeometry } from './MapGeometry.js';
import { OverlayManager } from './OverlayManager.js';
import { MapBuilder } from './MapBuilder.js';

class CustomSvgMap extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.svgNS = "http://www.w3.org/2000/svg";

        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: block;
                width: 100%;
                height: 100%;
                min-height: 70vh; /* Fallback for non-panel views */
                position: relative;
            }
        `;
        this.shadowRoot.appendChild(style);

        this.rooms = [];
        this.shortcuts = [];
        this.lastTime = 0;
        this.selectedRoomId = null;
        this.rotationMode = 'auto';
        this.activeOverlay = null;

        // renderRoot fills the host perfectly
        this.renderRoot = document.createElement('div');
        this.renderRoot.style.position = 'absolute';
        this.renderRoot.style.top = '0';
        this.renderRoot.style.left = '0';
        this.renderRoot.style.right = '0';
        this.renderRoot.style.bottom = '0';
        this.renderRoot.style.background = '#ffffff';
        this.renderRoot.style.display = 'block';
        this.renderRoot.style.overflow = 'hidden';

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

    static getConfigElement() {
        return document.createElement('custom-svg-map-editor');
    }

    static getStubConfig() {
        return { type: 'custom:custom-svg-map', default_floor: 1, floors: [1, 2] };
    }

    setConfig(config) {
        if (!config.floors || !config.floors.length) {
            this.config = { floors: [1, 2], default_floor: config.default_floor || config.floor || 1, ...config };
        } else {
            this.config = config;
        }
        this.activeFloor = this.config.default_floor || this.config.floors[0];
        this.loadData();
    }

    async loadData() {
        const floor = this.activeFloor;
        const t = new Date().getTime();
        const bgUrl = `/dynamic_map_data/bg_floor${floor}.png?t=${t}`;
        const roomsUrl = `/dynamic_map_data/rooms_floor${floor}.json?t=${t}`;
        const shortcutsUrl = `/dynamic_map_data/shortcuts_floor${floor}.json?t=${t}`;
        const configUrl = `/dynamic_map_data/config_floor${floor}.json?t=${t}`;

        try {
            const [roomsRes, shortcutsRes, configRes] = await Promise.all([
                fetch(`${roomsUrl}?t=${Date.now()}`).catch(() => ({ ok: false })),
                fetch(`${shortcutsUrl}?t=${Date.now()}`).catch(() => ({ ok: false })),
                fetch(`${configUrl}?t=${Date.now()}`).catch(() => ({ ok: false }))
            ]);

            if (roomsRes.ok) this.rooms = await roomsRes.json();
            else this.rooms = [];

            if (shortcutsRes && shortcutsRes.ok) this.shortcuts = await shortcutsRes.json();
            else this.shortcuts = [];
            
            let config = { rotation_mode: 'auto' };
            if (configRes && configRes.ok) config = await configRes.json();
            
            this.rotationMode = config.rotation_mode || 'auto';
            this.flips = config.flips || {
                horizontal: { h: false, v: false },
                vertical: { h: false, v: false }
            };

            const img = new Image();
            img.onload = () => {
                // Wait to ensure width is populated
                this.imgW = img.naturalWidth || 1000;
                this.imgH = img.naturalHeight || 1000;
                this.buildSVG(bgUrl);
            };
            img.onerror = () => {
                this.imgW = 1000;
                this.imgH = 1000;
                this.buildSVG(bgUrl);
            };
            img.src = bgUrl;

        } catch (e) {
            console.error("Failed to load map data", e);
            this.renderRoot.innerHTML = `<div style="color:red; padding: 20px;">Failed to load map data from /dynamic_map_ui/. Ensure rooms_floor${floor}.json is present.</div>`;
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

            let cx = 0, cy = 0;
            if (room.name) {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                room.polygon.forEach(pt => {
                    const px = (pt[0] / 100) * this.imgW;
                    const py = (pt[1] / 100) * this.imgH;
                    if (px < minX) minX = px;
                    if (px > maxX) maxX = px;
                    if (py < minY) minY = py;
                    if (py > maxY) maxY = py;
                });
                cx = minX + (maxX - minX) / 2;
                cy = minY + (maxY - minY) / 2;

                const text = document.createElementNS(this.svgNS, 'text');
                text.setAttribute('x', cx);
                text.setAttribute('y', cy);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'central');
                text.setAttribute('font-size', (this.imgW * 0.02).toString());
                text.setAttribute('fill', 'white');
                text.setAttribute('font-weight', 'bold');
                text.style.textShadow = '0px 0px 4px black, 0px 0px 4px black';
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

                if (room.entity_id && this._hass) {
                    const domain = room.entity_id.split('.')[0];
                    this._hass.callService(domain, 'toggle', { entity_id: room.entity_id });
                }
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

        // Setup top-left UI container for overlay controls
        this.topLeftUI = document.createElement('div');
        this.topLeftUI.style.position = 'absolute';
        this.topLeftUI.style.top = '10px';
        this.topLeftUI.style.left = '10px';
        this.topLeftUI.style.display = 'flex';
        this.topLeftUI.style.gap = '10px';
        this.topLeftUI.style.alignItems = 'stretch';
        this.topLeftUI.style.zIndex = '10';
        if (this.renderRoot) this.renderRoot.appendChild(this.topLeftUI);

        this.buildFloorSwitcher();
        this.buildRotationSwitcher();

        // Version badge appended last to avoid rotation logic
        this.versionText = document.createElementNS(this.svgNS, 'text');
        this.versionText.setAttribute('text-anchor', 'start');
        this.versionText.setAttribute('font-weight', 'bold');
        this.versionText.setAttribute('fill', 'red');
        this.versionText.textContent = "v2.2";
        this.svg.appendChild(this.versionText);

        if (this.cameraManager) this.cameraManager.destroy();
        this.cameraManager = new CameraManager(this.svg, this);

        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.lastTime = performance.now();
        this.animate(this.lastTime);
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
        
        const currentFlips = this.flips[activeMode];
        if (this.isRotated) {
            if (currentFlips.h) scaleY = -1;
            if (currentFlips.v) scaleX = -1;
        } else {
            if (currentFlips.h) scaleX = -1;
            if (currentFlips.v) scaleY = -1;
        }

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
            if (this.shortcutElements) {
                Object.values(this.shortcutElements).forEach(scObj => {
                    let scTransformStr = '';
                    if (scaleX !== 1 || scaleY !== 1) scTransformStr += `scale(${scaleX}, ${scaleY}) `;
                    if (this.isRotated) scTransformStr += `rotate(-90) `;
                    if (scObj.setTransformStr) scObj.setTransformStr(scTransformStr.trim());
                    else if (scObj.setRotation) scObj.setRotation(this.isRotated ? -90 : 0);
                });
            }

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
            if (this.shortcutElements) {
                Object.values(this.shortcutElements).forEach(scObj => {
                    if (scObj.setTransformStr) scObj.setTransformStr('');
                    else if (scObj.setRotation) scObj.setRotation(0);
                });
            }
        }

        // (rect calculation moved up)
        
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

    updateViewBox() {
        if (!this.svg) return;
        this.svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);

        if (this.mapWrapper) {
            this.mapWrapper.style.width = '100%';
            this.mapWrapper.style.height = '100%';
        }

        if (this.versionText) {
            this.versionText.setAttribute('x', this.vb.x + (this.vb.w * 0.02));
            this.versionText.setAttribute('y', this.vb.y + (this.vb.h * 0.06));
            this.versionText.setAttribute('font-size', (this.vb.h * 0.05).toString());
        }
    }



    set hass(hass) {
        this._hass = hass;

        let needsStyleUpdate = false;
        for (const id in this.shortcutElements) {
            const sc = this.shortcutElements[id];
            const changed = sc.updateState(hass);
            // If the shortcut represents a room light and it changed state, we need to update room styles
            if (changed && sc.sc.type === 'light') {
                needsStyleUpdate = true;
            }
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
            const hue = (idx * 137.5) % 360;

            let isOn = false;
            if (room.entity_id && this._hass) {
                const stateObj = this._hass.states[room.entity_id];
                if (stateObj && stateObj.state === 'on') isOn = true;
            }

            let rgb = null;
            if (room.color) {
                const hex = room.color.replace('#', '');
                if (hex.length === 6) {
                    rgb = {
                        r: parseInt(hex.substring(0, 2), 16),
                        g: parseInt(hex.substring(2, 4), 16),
                        b: parseInt(hex.substring(4, 6), 16)
                    };
                }
            }

            if (this.isSelectingRooms) {
                if (this.selectedRoomIds && this.selectedRoomIds.includes(room.id)) {
                    if (rgb) poly.setAttribute('fill', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
                    else poly.setAttribute('fill', `hsla(${hue}, 100%, 50%, 0.8)`);
                    poly.setAttribute('stroke', '#10b981');
                    poly.style.filter = 'drop-shadow(0px 0px 6px #10b981)';
                } else {
                    poly.setAttribute('fill', 'rgba(0,0,0,0.4)');
                    poly.setAttribute('stroke', 'rgba(255,255,255,0.2)');
                    poly.style.filter = 'none';
                }
                return;
            }

            if (isSelected) {
                if (rgb) poly.setAttribute('fill', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`);
                else poly.setAttribute('fill', `hsla(${hue}, 100%, 50%, 0.7)`);
                poly.setAttribute('stroke', '#00ffff');
                poly.style.filter = 'drop-shadow(0px 0px 5px #00ffff)';
            } else if (isOn) {
                if (rgb) {
                    poly.setAttribute('fill', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`);
                    poly.setAttribute('stroke', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
                } else {
                    poly.setAttribute('fill', `hsla(${hue}, 100%, 50%, 0.6)`);
                    poly.setAttribute('stroke', `hsla(${hue}, 100%, 50%, 1)`);
                }
                poly.style.filter = 'drop-shadow(0px 0px 8px yellow)';
            } else {
                if (rgb) {
                    poly.setAttribute('fill', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
                    poly.setAttribute('stroke', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`);
                } else {
                    poly.setAttribute('fill', `hsla(${hue}, 100%, 50%, 0.4)`);
                    poly.setAttribute('stroke', `hsla(${hue}, 100%, 50%, 0.9)`);
                }
                poly.style.filter = 'none';
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

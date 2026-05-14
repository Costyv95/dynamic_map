import { ShortcutFactory } from './shortcuts/ShortcutFactory.js';

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
        this.vacuumState = { status: 'unknown', room: 'unknown', x: 0, y: 0, targetX: 0, targetY: 0, activePolygon: null };
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
        if (this.config.floors.length <= 1) return;

        const switcher = document.createElement('div');
        switcher.className = 'floor-switcher';
        switcher.style.display = 'flex';
        switcher.style.flexDirection = 'column';
        switcher.style.background = 'rgba(255, 255, 255, 0.9)';
        switcher.style.borderRadius = '8px';
        switcher.style.overflow = 'hidden';
        switcher.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
        switcher.style.border = '1px solid #e2e8f0';

        this.config.floors.forEach(f => {
            const btn = document.createElement('div');
            btn.textContent = `Floor ${f}`;
            btn.style.padding = '8px 12px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = 'bold';
            btn.style.fontFamily = 'sans-serif';
            btn.style.borderBottom = '1px solid #e2e8f0';
            btn.style.color = '#1e293b';
            btn.style.background = (f == this.activeFloor) ? '#0ea5e9' : 'transparent';
            if (f == this.activeFloor) btn.style.color = 'white';

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.activeFloor !== f) {
                    this.activeFloor = f;
                    this.loadData();
                }
            });
            switcher.appendChild(btn);
        });
        switcher.lastChild.style.borderBottom = 'none';

        // Append to top-left UI container
        if (this.topLeftUI) {
            this.topLeftUI.appendChild(switcher);
        }
    }

    buildRotationSwitcher() {
        const switcher = document.createElement('button');
        switcher.className = 'rotation-switcher';
        switcher.style.background = 'rgba(255, 255, 255, 0.9)';
        switcher.style.border = '1px solid #e2e8f0';
        switcher.style.borderRadius = '8px';
        switcher.style.width = '42px';
        switcher.style.padding = '0';
        switcher.style.cursor = 'pointer';
        switcher.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
        switcher.style.display = 'flex';
        switcher.style.alignItems = 'center';
        switcher.style.justifyContent = 'center';
        switcher.style.color = '#1e293b';

        const updateIcon = () => {
            if (this.rotationMode === 'auto') {
                switcher.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><text x="12" y="16" font-size="10" font-family="sans-serif" text-anchor="middle" stroke="none" fill="currentColor">A</text></svg>`;
                switcher.title = 'Rotation Mode: Auto';
            } else if (this.rotationMode === 'horizontal') {
                switcher.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/></svg>`;
                switcher.title = 'Rotation Mode: Horizontal';
            } else {
                switcher.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/></svg>`;
                switcher.title = 'Rotation Mode: Vertical';
            }
        };

        updateIcon();

        switcher.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.rotationMode === 'auto') this.rotationMode = 'horizontal';
            else if (this.rotationMode === 'horizontal') this.rotationMode = 'vertical';
            else this.rotationMode = 'auto';
            
            updateIcon();
            this.calculateAutoCrop();
        });

        if (this.topLeftUI) {
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
            
            if (sc.type === 'vacuum') {
                this.vacuumState.x = shortcutObj.px;
                this.vacuumState.y = shortcutObj.py;
                this.vacuumState.targetX = shortcutObj.px;
                this.vacuumState.targetY = shortcutObj.py;
            }
            
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

        this.setupInteraction();

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
        const activeMode = this.isRotated ? 'vertical' : 'horizontal';
        const currentFlips = this.flips[activeMode];
        if (currentFlips.h) scaleX = -1;
        if (currentFlips.v) scaleY = -1;

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

    setupInteraction() {
        let isPanning = false;
        let startPan = { x: 0, y: 0 };
        let startVB = { x: 0, y: 0 };

        const getEventPos = (e) => {
            if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            return { x: e.clientX, y: e.clientY };
        };

        const onPointerDown = (e) => {
            isPanning = true;
            const pos = getEventPos(e);
            startPan = { x: pos.x, y: pos.y };
            startVB = { x: this.vb.x, y: this.vb.y };
        };

        const onPointerMove = (e) => {
            if (e.touches && e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                if (!this.initialPinchDist) {
                    this.initialPinchDist = dist;
                    this.initialVbW = this.vb.w;
                    this.initialVbH = this.vb.h;
                    this.initialVbX = this.vb.x;
                    this.initialVbY = this.vb.y;
                } else {
                    const zoomFactor = this.initialPinchDist / dist;
                    const newW = this.initialVbW * zoomFactor;
                    const newH = this.initialVbH * zoomFactor;

                    if (newW >= this.defaultVb.w * 0.99) {
                        this.vb = { ...this.defaultVb };
                    } else {
                        if (newW < (this.imgW * 0.05)) return;

                        const rect = this.svg.getBoundingClientRect();
                        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                        const mouseX = cx - rect.left;
                        const mouseY = cy - rect.top;

                        const vx = this.initialVbX + (mouseX / rect.width) * this.initialVbW;
                        const vy = this.initialVbY + (mouseY / rect.height) * this.initialVbH;

                        this.vb.w = newW;
                        this.vb.h = newH;
                        this.vb.x = vx - (mouseX / rect.width) * this.vb.w;
                        this.vb.y = vy - (mouseY / rect.height) * this.vb.h;
                    }
                    this.updateViewBox();
                }
                return;
            }

            if (!isPanning) return;
            e.preventDefault();
            const pos = getEventPos(e);
            const dx = pos.x - startPan.x;
            const dy = pos.y - startPan.y;

            const rect = this.svg.getBoundingClientRect();
            const scaleX = this.vb.w / rect.width;
            const scaleY = this.vb.h / rect.height;

            this.vb.x = startVB.x - (dx * scaleX);
            this.vb.y = startVB.y - (dy * scaleY);
            this.updateViewBox();
        };

        const onPointerUp = () => { isPanning = false; this.initialPinchDist = null; };

        this.svg.addEventListener('mousedown', onPointerDown);
        this.svg.addEventListener('mousemove', onPointerMove);
        this.svg.addEventListener('mouseup', onPointerUp);
        this.svg.addEventListener('mouseleave', onPointerUp);
        this.svg.addEventListener('touchstart', onPointerDown, { passive: false });
        this.svg.addEventListener('touchmove', onPointerMove, { passive: false });
        this.svg.addEventListener('touchend', onPointerUp);
        this.svg.addEventListener('touchcancel', onPointerUp);

        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const vx = this.vb.x + (mouseX / rect.width) * this.vb.w;
            const vy = this.vb.y + (mouseY / rect.height) * this.vb.h;

            const zoomSpeed = 0.001;
            let zoomFactor = Math.exp(-e.deltaY * zoomSpeed);
            if (zoomFactor > 1.2) zoomFactor = 1.2;
            if (zoomFactor < 0.8) zoomFactor = 0.8;

            const viewZoom = 1 / zoomFactor;
            const newW = this.vb.w * viewZoom;

            if (newW >= this.defaultVb.w * 0.99) {
                this.vb = { ...this.defaultVb };
            } else {
                if (newW < (this.imgW * 0.05)) return;
                this.vb.w = newW;
                this.vb.h *= viewZoom;
                this.vb.x = vx - (mouseX / rect.width) * this.vb.w;
                this.vb.y = vy - (mouseY / rect.height) * this.vb.h;
            }
            this.updateViewBox();
        });
    }

    set hass(hass) {
        this._hass = hass;

        for (const id in this.shortcutElements) {
            this.shortcutElements[id].updateState(hass);
        }

        this.updateRoomStyles();
    }

    updateVacuumLogic(sc) {
        console.log(`[Vacuum] Status: ${this.vacuumState.status}, Charging: ${this.vacuumState.isCharging}, Current Room Sensor: "${this.vacuumState.room}"`);
        
        // If it's explicitly charging, or offline/unknown without a room sensor, snap to dock
        const isOffline = ['unknown', 'device_offline'].includes((this.vacuumState.status || '').toLowerCase());
        const isTrackingRoom = !this.vacuumState.isCharging && !isOffline;
        
        if (!isTrackingRoom) {
            console.log(`[Vacuum] Vacuum is charging or offline. Snapping to dock.`);
            this.vacuumState.targetX = (sc.position[0] / 100) * this.imgW;
            this.vacuumState.targetY = (sc.position[1] / 100) * this.imgH;
            this.vacuumState.activePolygon = null;
        } else {
            let targetSvgRoomId = null;
            console.log(`[Vacuum] Evaluating mapping:`, sc.room_mapping);
            for (const [roboRoomName, svgRoomId] of Object.entries(sc.room_mapping || {})) {
                console.log(`[Vacuum] Checking if mapping key "${roboRoomName.toLowerCase()}" === sensor "${(this.vacuumState.room || '').toLowerCase()}"`);
                if (roboRoomName.toLowerCase() === (this.vacuumState.room || '').toLowerCase()) {
                    targetSvgRoomId = svgRoomId;
                    console.log(`[Vacuum] MATCH FOUND! Target SVG Room ID: ${targetSvgRoomId}`);
                    break;
                }
            }

            if (targetSvgRoomId) {
                const targetRoom = this.rooms.find(r => r.id === targetSvgRoomId);
                if (targetRoom) {
                    console.log(`[Vacuum] Valid SVG Room Found: ${targetRoom.name}`);
                    if (this.vacuumState.status === 'error') {
                        this.vacuumState.activePolygon = targetRoom.polygon;
                        const center = this.getPolygonCenter(targetRoom.polygon);
                        this.vacuumState.targetX = (center[0] / 100) * this.imgW;
                        this.vacuumState.targetY = (center[1] / 100) * this.imgH;
                    } else if (isTrackingRoom) {
                        if (this.vacuumState.activePolygon !== targetRoom.polygon) {
                            console.log(`[Vacuum] Moving to center of ${targetRoom.name}`);
                            this.vacuumState.activePolygon = targetRoom.polygon;
                            const center = this.getPolygonCenter(targetRoom.polygon);
                            this.vacuumState.targetX = (center[0] / 100) * this.imgW;
                            this.vacuumState.targetY = (center[1] / 100) * this.imgH;
                            // Teleport instantly to avoid flying through walls!
                            this.vacuumState.x = this.vacuumState.targetX;
                            this.vacuumState.y = this.vacuumState.targetY;
                        }
                    }
                } else {
                    console.log(`[Vacuum] Error: Target SVG Room ID ${targetSvgRoomId} does not exist in this.rooms!`);
                }
            } else {
                console.log(`[Vacuum] No mapping matched. Snapping to dock.`);
                this.vacuumState.targetX = (sc.position[0] / 100) * this.imgW;
                this.vacuumState.targetY = (sc.position[1] / 100) * this.imgH;
                this.vacuumState.activePolygon = null;
            }
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
        let avgX = 0, avgY = 0;
        polygon.forEach(pt => { avgX += pt[0]; avgY += pt[1]; });
        return [avgX / polygon.length, avgY / polygon.length];
    }

    isPointInPolygon(point, vs) {
        let x = point[0], y = point[1];
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i][0], yi = vs[i][1];
            let xj = vs[j][0], yj = vs[j][1];
            let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    getRandomPointInPolygon(polygon) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        polygon.forEach(pt => {
            if (pt[0] < minX) minX = pt[0];
            if (pt[0] > maxX) maxX = pt[0];
            if (pt[1] < minY) minY = pt[1];
            if (pt[1] > maxY) maxY = pt[1];
        });

        for (let i = 0; i < 100; i++) {
            const rx = minX + Math.random() * (maxX - minX);
            const ry = minY + Math.random() * (maxY - minY);
            if (this.isPointInPolygon([rx, ry], polygon)) {
                return [rx, ry];
            }
        }
        return this.getPolygonCenter(polygon);
    }

    showOverlay(shortcut, actions, event) {
        if (this.activeOverlay) {
            this.activeOverlay.remove();
        }
        
        // Ensure we capture clicks outside to close the overlay
        const outsideClickListener = (e) => {
            if (this.activeOverlay && !this.activeOverlay.contains(e.composedPath()[0])) {
                this.activeOverlay.remove();
                this.activeOverlay = null;
                document.removeEventListener('pointerdown', outsideClickListener);
            }
        };
        setTimeout(() => document.addEventListener('pointerdown', outsideClickListener), 50);

        this.activeOverlay = document.createElement('div');
        this.activeOverlay.style.position = 'absolute';
        
        // Calculate position relative to renderRoot
        const rect = this.renderRoot.getBoundingClientRect();
        let posX = event.clientX - rect.left;
        let posY = event.clientY - rect.top;
        
        this.activeOverlay.style.left = `${posX}px`;
        this.activeOverlay.style.top = `${posY}px`;
        this.activeOverlay.style.transform = 'translate(-50%, -100%) translateY(-20px)';
        this.activeOverlay.style.background = 'rgba(30, 41, 59, 0.9)';
        this.activeOverlay.style.backdropFilter = 'blur(10px)';
        this.activeOverlay.style.borderRadius = '12px';
        this.activeOverlay.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.5)';
        this.activeOverlay.style.zIndex = '1000';
        this.activeOverlay.style.color = '#fff';
        
        const isVisual = shortcut.sc && shortcut.sc.config && shortcut.sc.config.menuWidth;
        if (isVisual) {
            this.activeOverlay.style.width = shortcut.sc.config.menuWidth + 'px';
            this.activeOverlay.style.height = shortcut.sc.config.menuHeight + 'px';
            this.activeOverlay.style.display = 'block';
            this.activeOverlay.style.padding = '0';
            this.activeOverlay.style.overflow = 'hidden';
        } else {
            this.activeOverlay.style.padding = '10px';
            this.activeOverlay.style.display = 'flex';
            this.activeOverlay.style.flexDirection = 'column';
            this.activeOverlay.style.gap = '10px';
        }

        actions.forEach(act => {
            const target = act.action_entity || shortcut.sc.entity_id;
            
            if (act.type === 'SLIDER') {
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '5px';
                
                const label = document.createElement('span');
                const displayName = act.name !== undefined ? act.name : 'Brightness';
                if (displayName) {
                    label.textContent = displayName;
                    label.style.fontSize = '12px';
                    label.style.fontWeight = 'bold';
                    container.appendChild(label);
                }
                
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = '1';
                slider.max = '100';
                
                // Get current brightness if available
                if (this._hass && this._hass.states[target] && this._hass.states[target].attributes.brightness) {
                    slider.value = Math.round((this._hass.states[target].attributes.brightness / 255) * 100);
                } else {
                    slider.value = '50';
                }
                if (act.width) {
                    slider.style.width = act.width;
                } else {
                    slider.style.width = '150px';
                }
                
                slider.addEventListener('change', (e) => {
                    if (!this._hass) return;
                    this._hass.callService(target.split('.')[0], 'turn_on', {
                        entity_id: target,
                        brightness_pct: parseInt(e.target.value)
                    });
                });
                
                if (isVisual && act.pos_x !== undefined) {
                    container.style.position = 'absolute';
                    container.style.left = act.pos_x + 'px';
                    container.style.top = act.pos_y + 'px';
                    container.style.width = act.width + 'px';
                    container.style.height = act.height + 'px';
                    slider.style.width = '100%';
                    container.style.margin = '0';
                    container.style.justifyContent = 'center';
                    if (!displayName) container.style.alignItems = 'center';
                    if (act.rotation) container.style.transform = `rotate(${act.rotation}deg)`;
                }
                
                if (displayName) {
                    container.appendChild(slider);
                    this.activeOverlay.appendChild(container);
                } else {
                    if (isVisual && act.pos_x !== undefined) {
                        container.appendChild(slider);
                        this.activeOverlay.appendChild(container);
                    } else {
                        this.activeOverlay.appendChild(slider);
                    }
                }
            } else if (act.type === 'TOGGLE') {
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.justifyContent = 'space-between';
                container.style.alignItems = 'center';
                container.style.gap = '15px';
                container.style.padding = '6px 4px';
                if (act.width) container.style.width = act.width;
                
                let iconHtml = act.icon ? `<span style="margin-right:8px">${act.icon}</span>` : '';
                const displayName = act.name !== undefined ? act.name : 'Toggle';
                
                const label = document.createElement('span');
                label.innerHTML = `${iconHtml}${displayName}`;
                label.style.fontSize = '13px';
                
                let isOn = false;
                if (this._hass && this._hass.states[target]) {
                    isOn = this._hass.states[target].state === 'on';
                }
                
                const switchWrap = document.createElement('div');
                switchWrap.style.width = '36px';
                switchWrap.style.height = '20px';
                switchWrap.style.background = isOn ? '#10b981' : 'rgba(255,255,255,0.2)';
                switchWrap.style.borderRadius = '10px';
                switchWrap.style.position = 'relative';
                switchWrap.style.cursor = 'pointer';
                switchWrap.style.transition = 'background 0.2s';
                
                const thumb = document.createElement('div');
                thumb.style.width = '16px';
                thumb.style.height = '16px';
                thumb.style.background = '#fff';
                thumb.style.borderRadius = '50%';
                thumb.style.position = 'absolute';
                thumb.style.top = '2px';
                thumb.style.left = isOn ? '18px' : '2px';
                thumb.style.transition = 'left 0.2s';
                
                switchWrap.appendChild(thumb);
                
                switchWrap.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!this._hass) return;
                    const domain = target.split('.')[0];
                    let service = 'toggle';
                    if (domain === 'vacuum') service = 'start_pause';
                    this._hass.callService(domain, service, { entity_id: target });
                    
                    // Optimistic update
                    isOn = !isOn;
                    switchWrap.style.background = isOn ? '#10b981' : 'rgba(255,255,255,0.2)';
                    thumb.style.left = isOn ? '18px' : '2px';
                });
                
                container.appendChild(label);
                container.appendChild(switchWrap);
                
                if (isVisual && act.pos_x !== undefined) {
                    container.style.position = 'absolute';
                    container.style.left = act.pos_x + 'px';
                    container.style.top = act.pos_y + 'px';
                    container.style.width = act.width + 'px';
                    container.style.height = act.height + 'px';
                    container.style.margin = '0';
                    if (act.rotation) container.style.transform = `rotate(${act.rotation}deg)`;
                }
                
                this.activeOverlay.appendChild(container);

            } else if (act.type && (act.type === 'TOGGLE_ON' || act.type === 'TOGGLE_OFF' || act.type === 'CALL_SERVICE' || act.type === 'ROOM_SELECTOR')) {
                const btn = document.createElement('button');
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.border = '1px solid rgba(255,255,255,0.2)';
                btn.style.borderRadius = '6px';
                btn.style.padding = '8px';
                btn.style.color = '#fff';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '13px';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.gap = '8px';
                if (act.width) btn.style.width = act.width;
                
                if (act.type === 'TOGGLE_ON') {
                    btn.style.color = '#10b981';
                    btn.style.border = '1px solid rgba(16, 185, 129, 0.4)';
                } else if (act.type === 'TOGGLE_OFF') {
                    btn.style.color = '#ef4444';
                    btn.style.border = '1px solid rgba(239, 68, 68, 0.4)';
                } else if (act.type === 'ROOM_SELECTOR') {
                    btn.style.color = '#0ea5e9';
                    btn.style.border = '1px solid rgba(14, 165, 233, 0.4)';
                }
                
                let iconHtml = '';
                if (act.icon) {
                    iconHtml = `<span>${act.icon}</span>`;
                }
                
                let defaultName = act.type;
                if (act.type === 'TOGGLE_ON') defaultName = 'Turn On';
                if (act.type === 'TOGGLE_OFF') defaultName = 'Turn Off';
                if (act.type === 'CALL_SERVICE') defaultName = 'Run Action';
                if (act.type === 'ROOM_SELECTOR') defaultName = 'Select Rooms';
                
                const displayName = act.name !== undefined ? act.name : defaultName;
                const textHtml = displayName ? `<span>${displayName}</span>` : '';
                
                btn.innerHTML = `${iconHtml}${textHtml}`;
                
                // Add hover effect
                btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.2)';
                btn.onmouseleave = () => btn.style.background = 'rgba(255,255,255,0.1)';
                
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!this._hass || !target) return;
                    
                    if (act.type === 'ROOM_SELECTOR') {
                        this.closeOverlay();
                        this.isSelectingRooms = true;
                        this.selectedRoomIds = [];
                        this.selectionVacuumTarget = target;
                        this.updateRoomStyles();
                        this.showRoomSelectionUI();
                        return;
                    }
                    
                    if (act.type === 'CALL_SERVICE' && act.service) {
                        const parts = act.service.split('.');
                        if (parts.length === 2) {
                            let payload = { entity_id: target };
                            if (act.payload) {
                                try {
                                    const parsed = JSON.parse(act.payload);
                                    
                                    // Build mapping dictionary: Room Name -> Roborock ID
                                    let nameToRoboId = {};
                                    let scConfig = null;
                                    Object.values(this.shortcutElements).forEach(scEl => {
                                        if (scEl.sc && scEl.sc.entity_id === target) scConfig = scEl.sc.config;
                                    });
                                    if (scConfig && scConfig.room_mapping && this.rooms) {
                                        for (const [roboId, svgRoomId] of Object.entries(scConfig.room_mapping)) {
                                            const roomDef = this.rooms.find(r => r.id === svgRoomId);
                                            if (roomDef && roomDef.name) {
                                                nameToRoboId[roomDef.name] = isNaN(roboId) ? roboId : parseInt(roboId);
                                            }
                                        }
                                    }
                                    
                                    const replaceNamesWithIds = (obj) => {
                                        if (Array.isArray(obj)) {
                                            for (let i = 0; i < obj.length; i++) {
                                                if (typeof obj[i] === 'string' && nameToRoboId[obj[i]] !== undefined) obj[i] = nameToRoboId[obj[i]];
                                                else if (typeof obj[i] === 'object' && obj[i] !== null) replaceNamesWithIds(obj[i]);
                                            }
                                        } else if (typeof obj === 'object' && obj !== null) {
                                            for (const key in obj) {
                                                if (typeof obj[key] === 'string' && nameToRoboId[obj[key]] !== undefined) obj[key] = nameToRoboId[obj[key]];
                                                else if (typeof obj[key] === 'object' && obj[key] !== null) replaceNamesWithIds(obj[key]);
                                            }
                                        }
                                    };
                                    
                                    if (Object.keys(nameToRoboId).length > 0) {
                                        replaceNamesWithIds(parsed);
                                    }
                                    
                                    payload = { ...payload, ...parsed };
                                } catch (e) {
                                    console.error("[DynamicMap] Failed to parse action payload:", e);
                                }
                            }
                            this._hass.callService(parts[0], parts[1], payload);
                        }
                    } else if (act.type.startsWith('TOGGLE')) {
                        const domain = target.split('.')[0];
                        let service = act.type === 'TOGGLE_ON' ? 'turn_on' : 'turn_off';
                        
                        if (domain === 'vacuum') {
                            if (service === 'turn_on') service = 'start';
                            else if (service === 'turn_off') service = 'return_to_base';
                        }
                        
                        this._hass.callService(domain, service, { entity_id: target });
                    }
                });
                if (isVisual && act.pos_x !== undefined) {
                    btn.style.position = 'absolute';
                    btn.style.left = act.pos_x + 'px';
                    btn.style.top = act.pos_y + 'px';
                    btn.style.width = act.width + 'px';
                    btn.style.height = act.height + 'px';
                    btn.style.margin = '0';
                    if (act.rotation) btn.style.transform = `rotate(${act.rotation}deg)`;
                }
                
                this.activeOverlay.appendChild(btn);
            }
        });
        
        this.renderRoot.appendChild(this.activeOverlay);
    }

    showRoomSelectionUI() {
        if (this.roomSelectionUI) this.roomSelectionUI.remove();
        
        this.roomSelectionUI = document.createElement('div');
        this.roomSelectionUI.style.position = 'absolute';
        this.roomSelectionUI.style.bottom = '20px';
        this.roomSelectionUI.style.left = '50%';
        this.roomSelectionUI.style.transform = 'translateX(-50%)';
        this.roomSelectionUI.style.background = 'rgba(15, 23, 42, 0.95)';
        this.roomSelectionUI.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        this.roomSelectionUI.style.borderRadius = '12px';
        this.roomSelectionUI.style.padding = '15px';
        this.roomSelectionUI.style.color = '#fff';
        this.roomSelectionUI.style.display = 'flex';
        this.roomSelectionUI.style.flexDirection = 'column';
        this.roomSelectionUI.style.gap = '15px';
        this.roomSelectionUI.style.backdropFilter = 'blur(10px)';
        this.roomSelectionUI.style.boxShadow = '0px 10px 30px rgba(0,0,0,0.5)';
        this.roomSelectionUI.style.zIndex = '1001';
        
        const header = document.createElement('div');
        header.style.textAlign = 'center';
        header.style.fontWeight = 'bold';
        header.style.fontSize = '14px';
        header.innerText = 'Select Rooms on Map to Clean';
        
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '10px';
        controls.style.justifyContent = 'center';
        
        const repeats = document.createElement('select');
        repeats.innerHTML = '<option value="1">1x (Default)</option><option value="2">2x (Deep)</option><option value="3">3x (Max)</option>';
        repeats.style.background = 'rgba(0,0,0,0.5)';
        repeats.style.color = '#fff';
        repeats.style.border = '1px solid rgba(255,255,255,0.2)';
        repeats.style.borderRadius = '6px';
        repeats.style.padding = '8px';
        
        const mode = document.createElement('select');
        mode.innerHTML = '<option value="vac_mop">Vac & Mop</option><option value="vacuum">Vacuum Only</option><option value="mop">Mop Only</option>';
        mode.style.background = 'rgba(0,0,0,0.5)';
        mode.style.color = '#fff';
        mode.style.border = '1px solid rgba(255,255,255,0.2)';
        mode.style.borderRadius = '6px';
        mode.style.padding = '8px';
        
        controls.appendChild(repeats);
        controls.appendChild(mode);
        
        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.gap = '10px';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = 'Cancel';
        cancelBtn.style.flex = '1';
        cancelBtn.style.padding = '10px';
        cancelBtn.style.background = 'rgba(255,255,255,0.1)';
        cancelBtn.style.color = '#fff';
        cancelBtn.style.border = '1px solid rgba(255,255,255,0.2)';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.onclick = () => {
            this.isSelectingRooms = false;
            this.roomSelectionUI.remove();
            this.updateRoomStyles();
            if (this.selectionInterval) clearInterval(this.selectionInterval);
        };
        
        const startBtn = document.createElement('button');
        startBtn.innerText = 'Start Cleaning (0)';
        startBtn.style.flex = '2';
        startBtn.style.padding = '10px';
        startBtn.style.background = '#475569';
        startBtn.style.color = '#fff';
        startBtn.style.border = 'none';
        startBtn.style.borderRadius = '6px';
        startBtn.style.cursor = 'pointer';
        startBtn.style.fontWeight = 'bold';
        startBtn.onclick = () => {
            if (!this.selectedRoomIds || this.selectedRoomIds.length === 0) return;
            
            let scConfig = null;
            Object.values(this.shortcutElements).forEach(scEl => {
                if (scEl.sc && scEl.sc.entity_id === this.selectionVacuumTarget) {
                    scConfig = scEl.sc.config;
                }
            });
            
            let segments = [];
            if (scConfig && scConfig.room_mapping) {
                this.selectedRoomIds.forEach(id => {
                    let mappedId = null;
                    for (const [roboId, svgRoomId] of Object.entries(scConfig.room_mapping)) {
                        if (svgRoomId === id) {
                            mappedId = roboId;
                            break;
                        }
                    }
                    if (mappedId) segments.push(isNaN(mappedId) ? mappedId : parseInt(mappedId));
                });
            }
            
            if (segments.length === 0) {
                console.warn('[DynamicMap] No mapped room segments found for selection!');
                return;
            }
            
            // For Roborock specific mop modes (optional/best effort if domain is roborock)
            const domain = this.selectionVacuumTarget.split('.')[0];
            if (domain === 'roborock') {
                if (mode.value === 'vacuum') {
                    this._hass.callService('roborock', 'vacuum_set_mop_mode', { entity_id: this.selectionVacuumTarget, mop_mode: 'off' }).catch(e => {});
                } else if (mode.value === 'mop') {
                    this._hass.callService('roborock', 'vacuum_set_mop_mode', { entity_id: this.selectionVacuumTarget, mop_mode: 'standard' }).catch(e => {});
                    this._hass.callService('vacuum', 'set_fan_speed', { entity_id: this.selectionVacuumTarget, fan_speed: 'off' }).catch(e => {});
                } else {
                    this._hass.callService('roborock', 'vacuum_set_mop_mode', { entity_id: this.selectionVacuumTarget, mop_mode: 'standard' }).catch(e => {});
                    this._hass.callService('vacuum', 'set_fan_speed', { entity_id: this.selectionVacuumTarget, fan_speed: 'balanced' }).catch(e => {});
                }
            }
            
            this._hass.callService('vacuum', 'send_command', {
                entity_id: this.selectionVacuumTarget,
                command: 'app_segment_clean',
                params: [{ segments: segments, repeat: parseInt(repeats.value) }]
            });
            
            this.isSelectingRooms = false;
            this.roomSelectionUI.remove();
            this.updateRoomStyles();
            if (this.selectionInterval) clearInterval(this.selectionInterval);
        };
        
        this.selectionInterval = setInterval(() => {
            if (!this.isSelectingRooms) {
                clearInterval(this.selectionInterval);
                return;
            }
            startBtn.innerText = `Start Cleaning (${this.selectedRoomIds.length})`;
            startBtn.style.background = this.selectedRoomIds.length > 0 ? '#10b981' : '#475569';
        }, 200);
        
        buttons.appendChild(cancelBtn);
        buttons.appendChild(startBtn);
        
        this.roomSelectionUI.appendChild(header);
        this.roomSelectionUI.appendChild(controls);
        this.roomSelectionUI.appendChild(buttons);
        
        this.renderRoot.appendChild(this.roomSelectionUI);
    }

    getCardSize() { return 3; }
}

if (!customElements.get('custom-svg-map')) {
    customElements.define('custom-svg-map', CustomSvgMap);
}

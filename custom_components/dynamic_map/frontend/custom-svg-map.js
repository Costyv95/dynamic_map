// --- Shortcut Framework ---
class MapShortcut {
    constructor(scData, svgNS, imgW, imgH, mapContext) {
        this.sc = scData;
        this.svgNS = svgNS;
        this.imgW = imgW;
        this.imgH = imgH;
        this.mapContext = mapContext;
        this.group = document.createElementNS(svgNS, 'g');
        
        // Base positioning
        this.px = (scData.position[0] / 100) * imgW;
        this.py = (scData.position[1] / 100) * imgH;
        this.group.scX = this.px;
        this.group.scY = this.py;
        this.group.setAttribute('transform', `translate(${this.px}, ${this.py})`);
        
        this.scaleX = scData.scaleX || scData.scale || 1;
        this.scaleY = scData.scaleY || scData.scale || 1;
        this.rx = 12 * this.scaleX;
        this.ry = 12 * this.scaleY;
        
        // Configuration
        this.config = scData.config || {};
        
        // State badge for overlays
        this.stateBadge = document.createElementNS(svgNS, 'text');
        this.stateBadge.setAttribute('text-anchor', 'middle');
        this.stateBadge.setAttribute('dominant-baseline', 'central');
        this.stateBadge.setAttribute('font-size', 12);
        this.stateBadge.setAttribute('y', Math.max(this.rx, this.ry) + 14);
        this.stateBadge.setAttribute('fill', '#1e293b');
        this.stateBadge.style.textShadow = '0px 0px 2px white';
        
        this.group.classList.add('shortcut-group');
        this.setupInteractions();
    }
    
    setupInteractions() {
        this.group.style.cursor = 'pointer';
        this.group.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onClick();
        });
    }

    render() {
        this.group.appendChild(this.stateBadge);
        return this.group;
    }
    
    updateState(hass) {
        this.activeState = this.evaluateStates(hass);
    }
    
    evaluateStates(hass) {
        if (!this.config.states || !this.config.states.length) return null;
        for (const st of this.config.states) {
            if (!st.condition_entity || !hass.states[st.condition_entity]) continue;
            const actualVal = hass.states[st.condition_entity].state;
            const targetVal = st.value;
            let matched = false;
            if (st.operator === '==') matched = (actualVal == targetVal);
            if (st.operator === '!=') matched = (actualVal != targetVal);
            if (matched) return st;
        }
        return null;
    }
    
    onClick() {
        if (this.config.actions && this.config.actions.length > 0) {
            const tapActions = this.config.actions.filter(a => a.trigger === 'tap');
            if (tapActions.length > 0) {
                tapActions.forEach(act => {
                    const target = act.target || this.sc.entity_id;
                    if (!target || !this.mapContext._hass) return;
                    if (act.type === 'CALL_SERVICE' && act.service) {
                        const parts = act.service.split('.');
                        if (parts.length === 2) {
                            this.mapContext._hass.callService(parts[0], parts[1], { entity_id: target });
                        }
                    } else if (act.type && act.type.startsWith('TOGGLE')) {
                        const domain = target.split('.')[0];
                        const service = act.type === 'TOGGLE_ON' ? 'turn_on' : (act.type === 'TOGGLE_OFF' ? 'turn_off' : 'toggle');
                        this.mapContext._hass.callService(domain, service, { entity_id: target });
                    }
                });
                return;
            }
        }
        // Fallback default action
        if (this.sc.entity_id && this.mapContext._hass) {
            const domain = this.sc.entity_id.split('.')[0];
            this.mapContext._hass.callService(domain, 'toggle', { entity_id: this.sc.entity_id });
        }
    }
}

class GenericShortcut extends MapShortcut {
    render() {
        const shapeType = this.config.shape === 'rect' ? 'rect' : 'circle';
        this.shape = document.createElementNS(this.svgNS, shapeType);
        
        if (shapeType === 'rect') {
            this.shape.setAttribute('x', -this.rx);
            this.shape.setAttribute('y', -this.ry);
            this.shape.setAttribute('width', this.rx * 2);
            this.shape.setAttribute('height', this.ry * 2);
            this.shape.setAttribute('rx', 2);
        } else {
            this.shape.setAttribute('r', this.rx);
        }
        
        this.shape.setAttribute('fill', this.config.transparent ? 'rgba(0,0,0,0)' : (this.config.color || '#0ea5e9'));
        this.shape.setAttribute('stroke', 'white');
        this.shape.setAttribute('stroke-width', 2);
        this.group.appendChild(this.shape);
        
        this.iconText = document.createElementNS(this.svgNS, 'text');
        this.iconText.setAttribute('text-anchor', 'middle');
        this.iconText.setAttribute('dominant-baseline', 'central');
        this.iconText.setAttribute('font-size', 14 * Math.min(this.scaleX, this.scaleY));
        this.iconText.textContent = '💡';
        this.group.appendChild(this.iconText);
        
        super.render();
        return this.group;
    }
    
    updateState(hass) {
        super.updateState(hass);
        
        let color = this.config.color || '#0ea5e9';
        let icon = '💡';
        
        if (this.activeState) {
            if (this.activeState.color) color = this.activeState.color;
            if (this.activeState.icon) icon = this.activeState.icon;
        } else if (this.sc.entity_id && hass.states[this.sc.entity_id]) {
            // Legacy default toggle state logic if no states defined
            const stateObj = hass.states[this.sc.entity_id];
            if (stateObj.state === 'on') color = '#00ff00';
            else color = '#ffaa00';
        }
        
        if (!this.config.transparent) {
            this.shape.setAttribute('fill', color);
        }
        this.iconText.textContent = icon;
    }
}

class VacuumShortcut extends MapShortcut {
    render() {
        const shapeType = this.config.shape === 'rect' ? 'rect' : 'circle';
        const maxR = shapeType === 'rect' ? Math.min(this.rx, this.ry) : this.rx;
        
        this.inner1 = document.createElementNS(this.svgNS, 'circle');
        this.inner1.setAttribute('r', maxR * 0.8);
        this.inner1.setAttribute('fill', '#334155');
        
        this.inner2 = document.createElementNS(this.svgNS, 'circle');
        this.inner2.setAttribute('r', maxR * 0.4);
        this.inner2.setAttribute('fill', '#0ea5e9');
        
        this.inner3 = document.createElementNS(this.svgNS, 'circle');
        this.inner3.setAttribute('cx', maxR * 0.5);
        this.inner3.setAttribute('r', maxR * 0.15);
        this.inner3.setAttribute('fill', '#10b981');
        
        this.group.appendChild(this.inner1);
        this.group.appendChild(this.inner2);
        this.group.appendChild(this.inner3);
        
        super.render();
        return this.group;
    }
    
    updateState(hass) {
        super.updateState(hass);
        const entityId = this.sc.entity_id;
        if (!entityId) return;
        
        const baseName = entityId.replace('vacuum.', '');
        const statusState = hass.states[`sensor.${baseName}_status`] || hass.states[entityId];
        const roomState = hass.states[`sensor.${baseName}_current_room`];
        const chargingState = hass.states[`binary_sensor.${baseName}_charging`];

        this.mapContext.vacuumState.status = statusState ? statusState.state : 'unknown';
        this.mapContext.vacuumState.room = roomState ? roomState.state : 'unknown';
        this.mapContext.vacuumState.isCharging = chargingState ? (chargingState.state === 'on') : ['charging', 'docked', 'charging_complete'].includes(this.mapContext.vacuumState.status);

        if (this.activeState && this.activeState.icon) {
            this.stateBadge.textContent = this.activeState.icon;
        } else {
            // Default fallback logic
            if (this.mapContext.vacuumState.isCharging) this.stateBadge.textContent = '⚡';
            else if (this.mapContext.vacuumState.status === 'error') this.stateBadge.textContent = '❌';
            else if (this.mapContext.vacuumState.status.includes('clean') || this.mapContext.vacuumState.status === 'returning') this.stateBadge.textContent = '🧹';
            else this.stateBadge.textContent = '';
        }
        
        this.mapContext.updateVacuumLogic(this.sc);
    }
    
    animate(deltaTime) {
        const isOffline = ['unknown', 'device_offline'].includes((this.mapContext.vacuumState.status || '').toLowerCase());
        const isTrackingRoom = !this.mapContext.vacuumState.isCharging && !isOffline;

        if (isTrackingRoom && this.mapContext.vacuumState.activePolygon) {
            const distToTarget = Math.hypot(this.mapContext.vacuumState.targetX - this.mapContext.vacuumState.x, this.mapContext.vacuumState.targetY - this.mapContext.vacuumState.y);
            if (distToTarget < (this.imgW * 0.01)) {
                const newTarget = this.mapContext.getRandomPointInPolygon(this.mapContext.vacuumState.activePolygon);
                this.mapContext.vacuumState.targetX = (newTarget[0] / 100) * this.imgW;
                this.mapContext.vacuumState.targetY = (newTarget[1] / 100) * this.imgH;
            }
        }

        const dx = this.mapContext.vacuumState.targetX - this.mapContext.vacuumState.x;
        const dy = this.mapContext.vacuumState.targetY - this.mapContext.vacuumState.y;
        const dist = Math.hypot(dx, dy);

        const baseSpeed = (this.imgW + this.imgH) / 2;
        const speed = (isTrackingRoom) ? baseSpeed * 0.03 : baseSpeed * 0.15;

        if (dist > (this.imgW * 0.001)) {
            const moveAmt = Math.min(dist, speed * deltaTime);
            this.mapContext.vacuumState.x += (dx / dist) * moveAmt;
            this.mapContext.vacuumState.y += (dy / dist) * moveAmt;

            if (isNaN(this.mapContext.vacuumState.x) || isNaN(this.mapContext.vacuumState.y)) {
                this.mapContext.vacuumState.x = this.px;
                this.mapContext.vacuumState.y = this.py;
            }

            this.group.setAttribute('transform', `translate(${this.mapContext.vacuumState.x}, ${this.mapContext.vacuumState.y})`);
        }
    }
}

class ShortcutFactory {
    static create(scData, svgNS, imgW, imgH, mapContext) {
        // Legacy fallback
        if (!scData.config) {
            scData.config = {
                shape: scData.shape || 'circle',
                color: scData.color || '#0ea5e9',
                transparent: scData.transparent || false,
                room_mapping: scData.room_mapping || {}
            };
        }
        switch (scData.type) {
            case 'vacuum': return new VacuumShortcut(scData, svgNS, imgW, imgH, mapContext);
            default: return new GenericShortcut(scData, svgNS, imgW, imgH, mapContext);
        }
    }
}
// --- End Shortcut Framework ---

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

        try {
            const [roomsRes, shortcutsRes] = await Promise.all([
                fetch(`${roomsUrl}?t=${Date.now()}`).catch(() => ({ ok: false })),
                fetch(`${shortcutsUrl}?t=${Date.now()}`).catch(() => ({ ok: false }))
            ]);

            if (roomsRes.ok) this.rooms = await roomsRes.json();
            else this.rooms = [];

            if (shortcutsRes && shortcutsRes.ok) this.shortcuts = await shortcutsRes.json();
            else this.shortcuts = [];

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

        if (shouldRotate) {
            this.isRotated = true;
            this.mapRoot.setAttribute('transform', `rotate(90, ${cx}, ${cy})`);

            // Content rotated, swap target dimensions
            const temp = targetW;
            targetW = targetH;
            targetH = temp;


        } else {
            this.mapRoot.removeAttribute('transform');

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

            if (isSelected) {
                if (rgb) poly.setAttribute('fill', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
                else poly.setAttribute('fill', `hsla(${hue}, 100%, 50%, 0.5)`);
                poly.setAttribute('stroke', '#00ffff');
                poly.style.filter = 'drop-shadow(0px 0px 5px #00ffff)';
            } else if (isOn) {
                if (rgb) {
                    poly.setAttribute('fill', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
                    poly.setAttribute('stroke', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
                } else {
                    poly.setAttribute('fill', `hsla(${hue}, 100%, 50%, 0.4)`);
                    poly.setAttribute('stroke', `hsla(${hue}, 100%, 50%, 1)`);
                }
                poly.style.filter = 'drop-shadow(0px 0px 8px yellow)';
            } else {
                if (rgb) {
                    poly.setAttribute('fill', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
                    poly.setAttribute('stroke', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
                } else {
                    poly.setAttribute('fill', `hsla(${hue}, 100%, 50%, 0.15)`);
                    poly.setAttribute('stroke', `hsla(${hue}, 100%, 50%, 0.8)`);
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

    getCardSize() { return 3; }
}

if (!customElements.get('custom-svg-map')) {
    customElements.define('custom-svg-map', CustomSvgMap);
}

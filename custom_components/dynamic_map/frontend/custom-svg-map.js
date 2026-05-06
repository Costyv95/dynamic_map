class CustomSvgMap extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.svgNS = "http://www.w3.org/2000/svg";
        
        this.rooms = [];
        this.shortcuts = [];
        this.vacuumState = { status: 'unknown', room: 'unknown', x: 0, y: 0, targetX: 0, targetY: 0, activePolygon: null };
        this.lastTime = 0;
        
        this.renderRoot = document.createElement('div');
        this.renderRoot.style.position = 'relative';
        this.renderRoot.style.width = '100%';
        this.renderRoot.style.height = '100%';
        this.renderRoot.style.background = 'transparent';
        
        this.shadowRoot.appendChild(this.renderRoot);
        this.animationFrame = null;
    }

    setConfig(config) {
        if (!config.floor) {
            throw new Error('You need to define a floor number (e.g., floor: 1)');
        }
        this.config = config;
        this.loadData();
    }

    async loadData() {
        const floor = this.config.floor;
        // In HA, images/JSON uploaded to www are available at /local/
        const bgUrl = `/local/bg_floor${floor}.png`;
        const roomsUrl = `/local/rooms_floor${floor}.json`;
        const shortcutsUrl = `/local/shortcuts_floor${floor}.json`;

        try {
            const [roomsRes, shortcutsRes] = await Promise.all([
                fetch(roomsUrl),
                fetch(shortcutsUrl).catch(() => ({ ok: false }))
            ]);

            if (roomsRes.ok) this.rooms = await roomsRes.json();
            if (shortcutsRes && shortcutsRes.ok) this.shortcuts = await shortcutsRes.json();

            this.buildSVG(bgUrl);
        } catch (e) {
            console.error("Failed to load map data", e);
            this.renderRoot.innerHTML = `<div style="color:red; padding: 20px;">Failed to load map data from /local/. Ensure rooms_floor${floor}.json and shortcuts_floor${floor}.json are in your www folder.</div>`;
        }
    }

    buildSVG(bgUrl) {
        this.renderRoot.innerHTML = '';
        
        // We assume 1000x1000 base viewBox to map percentages
        this.svg = document.createElementNS(this.svgNS, 'svg');
        this.svg.setAttribute('viewBox', '0 0 100 100');
        this.svg.style.width = '100%';
        this.svg.style.height = '100%';
        this.svg.style.display = 'block';

        this.mapRoot = document.createElementNS(this.svgNS, 'g');
        this.mapRoot.id = 'map-root';

        // Background Image
        const image = document.createElementNS(this.svgNS, 'image');
        image.setAttribute('href', bgUrl);
        image.setAttribute('width', '100');
        image.setAttribute('height', '100');
        image.setAttribute('preserveAspectRatio', 'none');
        this.mapRoot.appendChild(image);

        // Draw Room Highlights (optional, for debug or visual effect)
        this.rooms.forEach(room => {
            const polygon = document.createElementNS(this.svgNS, 'polygon');
            const pointsStr = room.polygon.map(pt => `${pt[0]},${pt[1]}`).join(' ');
            polygon.setAttribute('points', pointsStr);
            polygon.setAttribute('fill', 'rgba(0, 255, 255, 0.05)');
            polygon.setAttribute('stroke', 'rgba(0, 255, 255, 0.2)');
            polygon.setAttribute('stroke-width', '0.2');
            this.mapRoot.appendChild(polygon);
            
            // Text Label
            if (room.name) {
                // Calculate center
                let minX = 100, maxX = 0, minY = 100, maxY = 0;
                room.polygon.forEach(pt => {
                    if(pt[0] < minX) minX = pt[0];
                    if(pt[0] > maxX) maxX = pt[0];
                    if(pt[1] < minY) minY = pt[1];
                    if(pt[1] > maxY) maxY = pt[1];
                });
                const cx = minX + (maxX - minX)/2;
                const cy = minY + (maxY - minY)/2;
                
                const text = document.createElementNS(this.svgNS, 'text');
                text.setAttribute('x', cx);
                text.setAttribute('y', cy);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'central');
                text.setAttribute('font-size', '2');
                text.setAttribute('fill', 'white');
                text.setAttribute('font-weight', 'bold');
                text.style.textShadow = '0px 0px 4px black, 0px 0px 4px black';
                text.textContent = room.name;
                text.classList.add('room-label');
                
                this.mapRoot.appendChild(text);
            }
        });

        // Initialize Shortcut Elements
        this.shortcutElements = {};
        this.shortcuts.forEach(sc => {
            const group = document.createElementNS(this.svgNS, 'g');
            // Store raw coordinates for counter-rotation calculation later
            group.scX = sc.position[0];
            group.scY = sc.position[1];
            group.setAttribute('transform', `translate(${sc.position[0]}, ${sc.position[1]})`);
            
            const scaleX = sc.scaleX || sc.scale || 1;
            const scaleY = sc.scaleY || sc.scale || 1;
            const rx = 1.5 * scaleX;
            const ry = 1.5 * scaleY;
            const r = Math.max(rx, ry);
            const shapeType = sc.shape === 'rect' ? 'rect' : 'circle';
            const shape = document.createElementNS(this.svgNS, shapeType);
            
            if (shapeType === 'rect') {
                shape.setAttribute('x', -rx);
                shape.setAttribute('y', -ry);
                shape.setAttribute('width', rx*2);
                shape.setAttribute('height', ry*2);
                shape.setAttribute('rx', 0.3);
            } else {
                shape.setAttribute('r', rx);
            }
            
            shape.setAttribute('fill', sc.transparent ? 'rgba(0,0,0,0)' : (sc.color || '#0ea5e9'));
            shape.setAttribute('stroke', 'white');
            shape.setAttribute('stroke-width', '0.2');
            group.appendChild(shape);

            if (sc.type === 'vacuum') {
                const inner1 = document.createElementNS(this.svgNS, 'circle');
                inner1.setAttribute('r', r * 0.8);
                inner1.setAttribute('fill', '#334155');
                const inner2 = document.createElementNS(this.svgNS, 'circle');
                inner2.setAttribute('r', r * 0.4);
                inner2.setAttribute('fill', '#0ea5e9');
                const inner3 = document.createElementNS(this.svgNS, 'circle');
                inner3.setAttribute('r', r * 0.15);
                inner3.setAttribute('cx', r * 0.5);
                inner3.setAttribute('fill', '#10b981');
                group.appendChild(inner1);
                group.appendChild(inner2);
                group.appendChild(inner3);
            } else {
                const text = document.createElementNS(this.svgNS, 'text');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'central');
                text.setAttribute('font-size', Math.min(rx, ry) * 1.2);
                text.textContent = '💡';
                group.appendChild(text);
            }

            const stateBadge = document.createElementNS(this.svgNS, 'text');
            stateBadge.setAttribute('text-anchor', 'middle');
            stateBadge.setAttribute('dominant-baseline', 'central');
            stateBadge.setAttribute('font-size', '1');
            stateBadge.setAttribute('y', r + 1); // Display visually below the icon
            stateBadge.setAttribute('fill', '#1e293b');
            stateBadge.style.textShadow = '0px 0px 2px white';
            group.appendChild(stateBadge);
            
            group.classList.add('shortcut-group');
            this.mapRoot.appendChild(group);

            this.shortcutElements[sc.id] = { group, stateBadge, sc };

            // Initialize Vacuum State
            if (sc.type === 'vacuum') {
                this.vacuumState.x = sc.position[0];
                this.vacuumState.y = sc.position[1];
            }
        });

        this.svg.appendChild(this.mapRoot);
        this.renderRoot.appendChild(this.svg);

        this.vb = { x: 0, y: 0, w: 100, h: 100 };
        this.calculateAutoCrop();
        this.setupInteraction();

        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.lastTime = performance.now();
        this.animate(this.lastTime);
    }

    calculateAutoCrop() {
        if (this.rooms.length === 0) return;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.rooms.forEach(r => {
            r.polygon.forEach(pt => {
                if(pt[0] < minX) minX = pt[0];
                if(pt[0] > maxX) maxX = pt[0];
                if(pt[1] < minY) minY = pt[1];
                if(pt[1] > maxY) maxY = pt[1];
            });
        });
        if (minX === Infinity) return;
        const w = maxX - minX;
        const h = maxY - minY;
        const cx = minX + w/2;
        const cy = minY + h/2;

        const mapRatio = w / h;
        const screenW = this.renderRoot.clientWidth || 100;
        const screenH = this.renderRoot.clientHeight || 100;
        const screenRatio = screenW / screenH;
        
        this.isRotated = (mapRatio > 1 && screenRatio < 1) || (mapRatio < 1 && screenRatio > 1);

        if (this.isRotated) {
            this.mapRoot.setAttribute('transform', `rotate(90, ${cx}, ${cy})`);
            
            // Counter-rotate text elements so they remain upright
            this.mapRoot.querySelectorAll('.room-label').forEach(t => {
                t.setAttribute('transform', `rotate(-90, ${t.getAttribute('x')}, ${t.getAttribute('y')})`);
            });
            this.mapRoot.querySelectorAll('.shortcut-group').forEach(g => {
                g.setAttribute('transform', `translate(${g.scX}, ${g.scY}) rotate(-90)`);
            });
        } else {
            this.mapRoot.removeAttribute('transform');
            this.mapRoot.querySelectorAll('.room-label').forEach(t => t.removeAttribute('transform'));
            this.mapRoot.querySelectorAll('.shortcut-group').forEach(g => {
                g.setAttribute('transform', `translate(${g.scX}, ${g.scY})`);
            });
        }

        let viewW = this.isRotated ? h : w;
        let viewH = this.isRotated ? w : h;

        const padX = viewW * 0.16666666;
        const padY = viewH * 0.16666666;
        
        this.vb = {
            x: cx - viewW/2 - padX,
            y: cy - viewH/2 - padY,
            w: viewW + 2*padX,
            h: viewH + 2*padY
        };
        this.defaultVb = { ...this.vb };
        this.updateViewBox();
    }

    updateViewBox() {
        this.svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);
    }

    setupInteraction() {
        let isPanning = false;
        let startPan = { x: 0, y: 0 };
        let startVB = { x: 0, y: 0 };

        const getEventPos = (e) => {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        };

        const onPointerDown = (e) => {
            isPanning = true;
            const pos = getEventPos(e);
            startPan = { x: pos.x, y: pos.y };
            startVB = { x: this.vb.x, y: this.vb.y };
        };

        const onPointerMove = (e) => {
            // Touch pinch-to-zoom
            if (e.touches && e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                if (!this.initialPinchDist) {
                    this.initialPinchDist = dist;
                    this.initialVbW = this.vb.w;
                    this.initialVbH = this.vb.h;
                    this.initialVbX = this.vb.x;
                    this.initialVbY = this.vb.y;
                } else {
                    const zoomFactor = this.initialPinchDist / dist; // Smaller dist = zoom out (larger viewBox)
                    const newW = this.initialVbW * zoomFactor;
                    const newH = this.initialVbH * zoomFactor;
                    
                    if (newW >= this.defaultVb.w * 0.99) {
                        this.vb = { ...this.defaultVb };
                    } else {
                        if (newW < 5) return;
                        
                        const rect = this.svg.getBoundingClientRect();
                        const cx = (e.touches[0].clientX + e.touches[1].clientX)/2;
                        const cy = (e.touches[0].clientY + e.touches[1].clientY)/2;
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

        const onPointerUp = () => { 
            isPanning = false; 
            this.initialPinchDist = null;
        };

        this.svg.addEventListener('mousedown', onPointerDown);
        this.svg.addEventListener('mousemove', onPointerMove);
        this.svg.addEventListener('mouseup', onPointerUp);
        this.svg.addEventListener('mouseleave', onPointerUp);
        
        this.svg.addEventListener('touchstart', onPointerDown, {passive: false});
        this.svg.addEventListener('touchmove', onPointerMove, {passive: false});
        this.svg.addEventListener('touchend', onPointerUp);
        this.svg.addEventListener('touchcancel', onPointerUp);

        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const vx = this.vb.x + (mouseX / rect.width) * this.vb.w;
            const vy = this.vb.y + (mouseY / rect.height) * this.vb.h;

            // Smoother zoom based on delta
            const zoomSpeed = 0.001;
            let zoomFactor = Math.exp(-e.deltaY * zoomSpeed);
            if (zoomFactor > 1.2) zoomFactor = 1.2;
            if (zoomFactor < 0.8) zoomFactor = 0.8;

            // Inverted for viewBox math: > 1 means zooming in (smaller viewBox)
            const viewZoom = 1 / zoomFactor;
            
            const newW = this.vb.w * viewZoom;

            if (newW >= this.defaultVb.w * 0.99) {
                this.vb = { ...this.defaultVb };
            } else {
                if (newW < 5) return;
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
        
        // Update shortcuts based on state
        for (const id in this.shortcutElements) {
            const el = this.shortcutElements[id];
            const entityId = el.sc.entity_id;
            
            if (el.sc.type === 'vacuum') {
                // Determine vacuum state
                // Use the base entity to guess status and room sensors, or config.
                // Assuming default silvester format:
                const baseName = entityId.replace('vacuum.', '');
                const statusState = hass.states[`sensor.${baseName}_status`];
                const roomState = hass.states[`sensor.${baseName}_current_room`];
                
                if (statusState) this.vacuumState.status = statusState.state;
                if (roomState) this.vacuumState.room = roomState.state;

                this.updateVacuumLogic(el.sc);
                
                // Update Badge
                if (this.vacuumState.status === 'charging') el.stateBadge.textContent = '⚡';
                else if (this.vacuumState.status === 'error') el.stateBadge.textContent = '❌';
                else if (this.vacuumState.status === 'cleaning') el.stateBadge.textContent = '🧹';
                else el.stateBadge.textContent = '';
                
            } else {
                // Generic state coloring
                const stateObj = hass.states[entityId];
                if (stateObj) {
                    const isOn = stateObj.state === 'on';
                    el.group.querySelector('circle').setAttribute('fill', isOn ? '#00ff00' : '#ffaa00');
                }
            }
        }
    }

    updateVacuumLogic(sc) {
        if (this.vacuumState.status === 'charging') {
            this.vacuumState.targetX = sc.position[0];
            this.vacuumState.targetY = sc.position[1];
            this.vacuumState.activePolygon = null;
        } else {
            // Find the SVG room ID based on the mapping
            let targetSvgRoomId = null;
            for (const [svgRoomId, roboRoomName] of Object.entries(sc.room_mapping || {})) {
                if (roboRoomName.toLowerCase() === this.vacuumState.room.toLowerCase()) {
                    targetSvgRoomId = svgRoomId;
                    break;
                }
            }

            if (targetSvgRoomId) {
                const targetRoom = this.rooms.find(r => r.id === targetSvgRoomId);
                if (targetRoom) {
                    this.vacuumState.activePolygon = targetRoom.polygon;
                    
                    if (this.vacuumState.status === 'error') {
                        // Snap to Centroid
                        const center = this.getPolygonCenter(targetRoom.polygon);
                        this.vacuumState.targetX = center[0];
                        this.vacuumState.targetY = center[1];
                    } else if (this.vacuumState.status === 'cleaning') {
                        // Needs to pick a random target if it reached the current one
                        const dist = Math.hypot(this.vacuumState.x - this.vacuumState.targetX, this.vacuumState.y - this.vacuumState.targetY);
                        if (dist < 1 || !this.isPointInPolygon([this.vacuumState.targetX, this.vacuumState.targetY], targetRoom.polygon)) {
                            // Pick new random point in polygon
                            const newTarget = this.getRandomPointInPolygon(targetRoom.polygon);
                            this.vacuumState.targetX = newTarget[0];
                            this.vacuumState.targetY = newTarget[1];
                        }
                    }
                }
            }
        }
    }

    animate(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000; // seconds
        this.lastTime = currentTime;

        // Move vacuums
        for (const id in this.shortcutElements) {
            const el = this.shortcutElements[id];
            if (el.sc.type === 'vacuum') {
                const dx = this.vacuumState.targetX - this.vacuumState.x;
                const dy = this.vacuumState.targetY - this.vacuumState.y;
                const dist = Math.hypot(dx, dy);
                
                // Speed is 5% of map per second while cleaning, 20% while snapping back
                const speed = (this.vacuumState.status === 'cleaning') ? 2 : 10; 
                
                if (dist > 0.1) {
                    const moveAmt = Math.min(dist, speed * deltaTime);
                    this.vacuumState.x += (dx / dist) * moveAmt;
                    this.vacuumState.y += (dy / dist) * moveAmt;
                    
                    el.group.setAttribute('transform', `translate(${this.vacuumState.x}, ${this.vacuumState.y})`);
                }
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
        // Simple bounding box rejection sampling
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        polygon.forEach(pt => {
            if(pt[0] < minX) minX = pt[0];
            if(pt[0] > maxX) maxX = pt[0];
            if(pt[1] < minY) minY = pt[1];
            if(pt[1] > maxY) maxY = pt[1];
        });

        for(let i=0; i<100; i++) {
            const rx = minX + Math.random() * (maxX - minX);
            const ry = minY + Math.random() * (maxY - minY);
            if (this.isPointInPolygon([rx, ry], polygon)) {
                return [rx, ry];
            }
        }
        return this.getPolygonCenter(polygon); // fallback
    }

    getCardSize() { return 3; }
}

customElements.define('custom-svg-map', CustomSvgMap);

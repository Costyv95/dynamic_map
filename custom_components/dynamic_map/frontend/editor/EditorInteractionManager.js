import { MapGeometry } from '../shared/MapGeometry.js?v=3.0.3-b7c3193-dev-182821';
import { CanvasEngine } from './CanvasEngine.js?v=3.0.3-b7c3193-dev-182821';

export class EditorInteractionManager {
    constructor(canvas, engine, stateManager) {
        this.canvas = canvas;
        this.engine = engine;
        this.state = stateManager;

        this.isDragging = false;
        this.dragStart = null;
        this.interactionState = 'NONE'; // NONE, PAN, DRAG_SC, SPLIT, RESIZE_SC, DRAW_POLY
        
        this.panStart = null;
        this.resizeHandle = null;
        this.initialPinchDist = null;
        this.initialViewTransform = null;
        
        // For polygon drawing
        this.drawingPolygon = null;

        this.bindEvents();
    }

    getMousePos(e) {
        return this.engine.getMousePos(e);
    }

    getShortcutPos(sc) {
        const activeMode = this.engine.activeMode || 'horizontal';
        let pos = sc.position;
        if (pos && typeof pos === 'object' && !Array.isArray(pos)) {
            return pos[activeMode] || pos.horizontal || [50, 50];
        }
        return pos || [50, 50];
    }

    setShortcutPos(sc, pctX, pctY) {
        const activeMode = this.engine.activeMode || 'horizontal';
        if (sc.position && typeof sc.position === 'object' && !Array.isArray(sc.position)) {
            sc.position[activeMode] = [pctX, pctY];
        } else {
            const oldPos = sc.position || [50, 50];
            sc.position = {
                horizontal: [...oldPos],
                vertical: [...oldPos]
            };
            sc.position[activeMode] = [pctX, pctY];
        }
    }

    getShortcutScale(sc) {
        const activeMode = this.engine.activeMode || 'horizontal';
        
        let scScale = 1.0;
        if (sc.scale !== undefined) {
            if (typeof sc.scale === 'object' && !Array.isArray(sc.scale)) {
                scScale = sc.scale[activeMode] !== undefined ? sc.scale[activeMode] : (sc.scale.horizontal || 1.0);
            } else {
                scScale = sc.scale;
            }
        }
        
        let scaleX = scScale;
        if (sc.scaleX !== undefined) {
            if (typeof sc.scaleX === 'object' && !Array.isArray(sc.scaleX)) {
                scaleX = sc.scaleX[activeMode] !== undefined ? sc.scaleX[activeMode] : (sc.scaleX.horizontal || scScale);
            } else {
                scaleX = sc.scaleX;
            }
        }
        
        let scaleY = scScale;
        if (sc.scaleY !== undefined) {
            if (typeof sc.scaleY === 'object' && !Array.isArray(sc.scaleY)) {
                scaleY = sc.scaleY[activeMode] !== undefined ? sc.scaleY[activeMode] : (sc.scaleY.horizontal || scScale);
            } else {
                scaleY = sc.scaleY;
            }
        }
        
        return { scale: scScale, scaleX, scaleY };
    }

    setShortcutScale(sc, prop, value) {
        const activeMode = this.engine.activeMode || 'horizontal';
        
        if (sc[prop] === undefined || typeof sc[prop] !== 'object' || Array.isArray(sc[prop])) {
            const oldVal = sc[prop] !== undefined ? sc[prop] : 1.0;
            sc[prop] = {
                horizontal: oldVal,
                vertical: oldVal
            };
        }
        sc[prop][activeMode] = value;
    }

    getShortcutRotation(sc) {
        const activeMode = this.engine.activeMode || 'horizontal';
        let rot = 0;
        if (sc.rotation !== undefined) {
            if (typeof sc.rotation === 'object' && !Array.isArray(sc.rotation)) {
                rot = sc.rotation[activeMode] !== undefined ? sc.rotation[activeMode] : (sc.rotation.horizontal || 0);
            } else {
                rot = sc.rotation;
            }
        }
        return rot;
    }

    setShortcutRotation(sc, value) {
        const activeMode = this.engine.activeMode || 'horizontal';
        if (sc.rotation === undefined || typeof sc.rotation !== 'object' || Array.isArray(sc.rotation)) {
            const oldVal = sc.rotation !== undefined ? sc.rotation : 0;
            sc.rotation = {
                horizontal: oldVal,
                vertical: oldVal
            };
        }
        sc.rotation[activeMode] = value;
    }

    bindEvents() {
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.engine.handleZoom(e.clientX, e.clientY, e.deltaY);
            this.state.requestDrawCallback();
        }, { passive: false });

        this.canvas.addEventListener('mousedown', this.onPointerDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onPointerMove.bind(this));
        window.addEventListener('mouseup', this.onPointerUp.bind(this));
        
        this.canvas.addEventListener('touchstart', this.onPointerDown.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.onPointerMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.onPointerUp.bind(this));
        
        // Keydown for polygon drawing
        document.addEventListener('keydown', this.onKeyDown.bind(this));
    }

    onPointerDown(e) {
        if (e.button === 2) { // Right Click
            if (this.state.isEditMode && this.state.selectedRooms.length === 1) {
                this.interactionState = 'SPLIT';
                this.state.splitStart = this.getMousePos(e);
                this.state.isSplitting = false;
            }
            e.preventDefault();
            return;
        }

        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        
        // If Shift is pressed and in edit mode -> Draw Polygon
        if (e.shiftKey && this.state.isEditMode) {
            this.interactionState = 'DRAW_POLY';
            const wp = this.getMousePos(e);
            if (!this.drawingPolygon) this.drawingPolygon = [];
            const { bgW, bgH } = CanvasEngine.safeDimensions(this.state.bgImage);
            this.drawingPolygon.push([(wp.x / bgW)*100, (wp.y / bgH)*100]);
            this.state.requestDrawCallback();
            return;
        }

        this.panStart = { x: clientX, y: clientY };
        this.dragStart = this.getMousePos(e);
        this.isDragging = false;
        this.resizeHandle = null;

        const { bgW, bgH } = CanvasEngine.safeDimensions(this.state.bgImage);

        // Check Resize Handles
        if (this.state.selectedShortcutIdx !== -1 && this.state.shortcuts[this.state.selectedShortcutIdx]) {
            const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
            const pos = this.getShortcutPos(sc);
            const scX = (pos[0]/100)*bgW;
            const scY = (pos[1]/100)*bgH;
            const baseRx = sc.type === 'sensor' ? 26 : 12;
            const baseRy = 12;
            
            const scScale = this.getShortcutScale(sc);
            const rx = baseRx * scScale.scaleX;
            const ry = baseRy * scScale.scaleY;
            const scRotation = this.getShortcutRotation(sc);
            
            const currentScale = Math.hypot(this.engine.viewTransform.a, this.engine.viewTransform.b);
            const hSize = 8 / currentScale;

            const hitTest = (px, py, hx, hy) => Math.hypot(px - hx, py - hy) < hSize * 2;

            const autoRotate = sc.config?.autoRotate || false;
            let checkX = this.dragStart.x;
            let checkY = this.dragStart.y;
            if (this.engine.isRotated && !autoRotate) {
                const dx = this.dragStart.x - scX;
                const dy = this.dragStart.y - scY;
                checkX = scX - dy;
                checkY = scY + dx;
            }
            
            if (scRotation) {
                const dx = checkX - scX;
                const dy = checkY - scY;
                const rad = (-scRotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                checkX = scX + (dx * cos - dy * sin);
                checkY = scY + (dx * sin + dy * cos);
            }

            if (hitTest(checkX, checkY, scX - rx, scY - ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'NW'; return; }
            if (hitTest(checkX, checkY, scX + rx, scY - ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'NE'; return; }
            if (hitTest(checkX, checkY, scX - rx, scY + ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'SW'; return; }
            if (hitTest(checkX, checkY, scX + rx, scY + ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'SE'; return; }
            if (hitTest(checkX, checkY, scX, scY - ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'N'; return; }
            if (hitTest(checkX, checkY, scX, scY + ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'S'; return; }
            if (hitTest(checkX, checkY, scX - rx, scY)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'W'; return; }
            if (hitTest(checkX, checkY, scX + rx, scY)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'E'; return; }
        }

        let overScIdx = -1;
        for (let i = this.state.shortcuts.length - 1; i >= 0; i--) {
            const sc = this.state.shortcuts[i];
            const pos = this.getShortcutPos(sc);
            const scX = (pos[0]/100)*bgW;
            const scY = (pos[1]/100)*bgH;
            const baseRx = sc.type === 'sensor' ? 26 : 12;
            const baseRy = 12;
            const scScale = this.getShortcutScale(sc);
            const rx = baseRx * scScale.scaleX;
            const ry = baseRy * scScale.scaleY;
            
            const shape = sc.type === 'sensor' ? 'rect' : (sc.config?.shape || sc.shape || 'circle');
            
            const autoRotate = sc.config?.autoRotate || false;
            let checkX = this.dragStart.x;
            let checkY = this.dragStart.y;
            if (this.engine.isRotated && !autoRotate) {
                const dx = this.dragStart.x - scX;
                const dy = this.dragStart.y - scY;
                checkX = scX - dy;
                checkY = scY + dx;
            }

            const scRotation = this.getShortcutRotation(sc);
            if (scRotation) {
                const dx = checkX - scX;
                const dy = checkY - scY;
                const rad = (-scRotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                checkX = scX + (dx * cos - dy * sin);
                checkY = scY + (dx * sin + dy * cos);
            }

            if (shape === 'rect') {
                if (Math.abs(checkX - scX) <= rx && Math.abs(checkY - scY) <= ry) {
                    overScIdx = i; break;
                }
            } else {
                if (Math.hypot(checkX - scX, checkY - scY) <= Math.max(rx, ry)) {
                    overScIdx = i; break;
                }
            }
        }

        if (overScIdx !== -1) {
            this.state.selectedShortcutIdx = overScIdx;
            this.state.selectedRooms = [];
            this.interactionState = 'DRAG_SC';
            this.state.updateUICallback();
            this.state.requestDrawCallback();
            return;
        }

        this.interactionState = 'MAYBE_PAN';
    }

    onPointerMove(e) {
        if (e.touches && e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (!this.initialPinchDist) {
                this.initialPinchDist = dist;
                this.initialViewTransform = new DOMMatrix(this.engine.viewTransform);
            } else {
                const zoomFactor = dist / this.initialPinchDist;
                const rect = this.canvas.getBoundingClientRect();
                const cx = (e.touches[0].clientX + e.touches[1].clientX)/2;
                const cy = (e.touches[0].clientY + e.touches[1].clientY)/2;
                const screenX = cx - rect.left;
                const screenY = cy - rect.top;

                const newTransform = new DOMMatrix().translate(screenX, screenY).scale(zoomFactor).translate(-screenX, -screenY).multiply(this.initialViewTransform);
                const currentScale = Math.hypot(newTransform.a, newTransform.b);

                if (currentScale <= this.engine.minScale * 1.02 && zoomFactor < 1) {
                    this.engine.viewTransform = new DOMMatrix(this.engine.defaultTransform);
                } else {
                    this.engine.viewTransform = newTransform;
                }
                this.state.requestDrawCallback();
            }
            return;
        }

        if (this.interactionState === 'NONE' || this.interactionState === 'MAYBE_PAN') {
            const worldPos = this.getMousePos(e);
            let cursorStyle = 'default';
            let overShortcut = false;
            const { bgW, bgH } = CanvasEngine.safeDimensions(this.state.bgImage);

            if (this.state.selectedShortcutIdx !== -1) {
                const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                const pos = this.getShortcutPos(sc);
                const scX = (pos[0]/100)*bgW;
                const scY = (pos[1]/100)*bgH;
                const baseRx = sc.type === 'sensor' ? 26 : 12;
                const baseRy = 12;
                const scScale = this.getShortcutScale(sc);
                const rx = baseRx * scScale.scaleX;
                const ry = baseRy * scScale.scaleY;
                const currentScale = Math.hypot(this.engine.viewTransform.a, this.engine.viewTransform.b);
                const hSize = 8 / currentScale;

                const hitTest = (px, py, hx, hy) => Math.hypot(px - hx, py - hy) < hSize * 2;
                
                const autoRotate = sc.config?.autoRotate || false;
                let checkX = worldPos.x;
                let checkY = worldPos.y;
                if (this.engine.isRotated && !autoRotate) {
                    const dx = worldPos.x - scX;
                    const dy = worldPos.y - scY;
                    checkX = scX - dy;
                    checkY = scY + dx;
                }

                const scRotation = this.getShortcutRotation(sc);
                if (scRotation) {
                    const dx = checkX - scX;
                    const dy = checkY - scY;
                    const rad = (-scRotation * Math.PI) / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    checkX = scX + (dx * cos - dy * sin);
                    checkY = scY + (dx * sin + dy * cos);
                }

                if (hitTest(checkX, checkY, scX - rx, scY - ry) || hitTest(checkX, checkY, scX + rx, scY + ry)) {
                    cursorStyle = this.engine.isRotated ? 'nesw-resize' : 'nwse-resize';
                } else if (hitTest(checkX, checkY, scX + rx, scY - ry) || hitTest(checkX, checkY, scX - rx, scY + ry)) {
                    cursorStyle = this.engine.isRotated ? 'nwse-resize' : 'nesw-resize';
                } else if (hitTest(checkX, checkY, scX, scY - ry) || hitTest(checkX, checkY, scX, scY + ry)) {
                    cursorStyle = this.engine.isRotated ? 'ew-resize' : 'ns-resize';
                } else if (hitTest(checkX, checkY, scX - rx, scY) || hitTest(checkX, checkY, scX + rx, scY)) {
                    cursorStyle = this.engine.isRotated ? 'ns-resize' : 'ew-resize';
                }
            }

            if (cursorStyle === 'default') {
                for (let i = this.state.shortcuts.length - 1; i >= 0; i--) {
                    const sc = this.state.shortcuts[i];
                    const pos = this.getShortcutPos(sc);
                    const scX = (pos[0]/100)*bgW;
                    const scY = (pos[1]/100)*bgH;
                    const baseRx = sc.type === 'sensor' ? 26 : 12;
                    const baseRy = 12;
                    const scScale = this.getShortcutScale(sc);
                    const rx = baseRx * scScale.scaleX;
                    const ry = baseRy * scScale.scaleY;
                    
                    const shape = sc.type === 'sensor' ? 'rect' : (sc.config?.shape || sc.shape || 'circle');
                    
                    const autoRotate = sc.config?.autoRotate || false;
                    let checkX = worldPos.x;
                    let checkY = worldPos.y;
                    if (this.engine.isRotated && !autoRotate) {
                        const dx = worldPos.x - scX;
                        const dy = worldPos.y - scY;
                        checkX = scX - dy;
                        checkY = scY + dx;
                    }

                    const scRotation = this.getShortcutRotation(sc);
                    if (scRotation) {
                        const dx = checkX - scX;
                        const dy = checkY - scY;
                        const rad = (-scRotation * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        checkX = scX + (dx * cos - dy * sin);
                        checkY = scY + (dx * sin + dy * cos);
                    }

                    if (shape === 'rect') {
                        if (Math.abs(checkX - scX) <= rx && Math.abs(checkY - scY) <= ry) {
                            overShortcut = true; break;
                        }
                    } else {
                        if (Math.hypot(checkX - scX, checkY - scY) <= Math.max(rx, ry)) {
                            overShortcut = true; break;
                        }
                    }
                }
                if (overShortcut) {
                    cursorStyle = 'move';
                }
            }
            this.canvas.style.cursor = cursorStyle;
        }

        if (this.interactionState === 'SPLIT') {
            this.state.isSplitting = true;
            this.state.splitEnd = this.getMousePos(e);
            this.state.requestDrawCallback();
            return;
        }

        if (this.interactionState === 'DRAG_SC') {
            this.isDragging = true;
            const worldPos = this.getMousePos(e);
            const { bgW, bgH } = CanvasEngine.safeDimensions(this.state.bgImage);
            this.setShortcutPos(this.state.shortcuts[this.state.selectedShortcutIdx], (worldPos.x / bgW)*100, (worldPos.y / bgH)*100);
            this.state.requestDrawCallback();
            return;
        }

        if (this.interactionState === 'RESIZE_SC') {
            this.isDragging = true;
            const worldPos = this.getMousePos(e);
            const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
            const { bgW: sBgW, bgH: sBgH } = CanvasEngine.safeDimensions(this.state.bgImage);
            const pos = this.getShortcutPos(sc);
            const scX = (pos[0]/100)*sBgW;
            const scY = (pos[1]/100)*sBgH;
            
            const autoRotate = sc.config?.autoRotate || false;
            let checkX = worldPos.x;
            let checkY = worldPos.y;
            if (this.engine.isRotated && !autoRotate) {
                const rDx = worldPos.x - scX;
                const rDy = worldPos.y - scY;
                checkX = scX - rDy;
                checkY = scY + rDx;
            }

            const dx = Math.abs(checkX - scX);
            const dy = Math.abs(checkY - scY);
            
            const divisorRx = sc.type === 'sensor' ? 26 : 12;
            const divisorRy = 12;
            const shape = sc.config?.shape || sc.shape || 'circle';
            const isUniform = shape === 'circle';
            if (this.resizeHandle.includes('E') || this.resizeHandle.includes('W')) {
                const val = Math.max(0.5, dx / divisorRx);
                this.setShortcutScale(sc, 'scaleX', val);
                this.setShortcutScale(sc, 'scale', val);
                if (isUniform) {
                    this.setShortcutScale(sc, 'scaleY', val);
                }
            }
            if (this.resizeHandle.includes('N') || this.resizeHandle.includes('S')) {
                const val = Math.max(0.5, dy / divisorRy);
                this.setShortcutScale(sc, 'scaleY', val);
                this.setShortcutScale(sc, 'scale', val);
                if (isUniform) {
                    this.setShortcutScale(sc, 'scaleX', val);
                }
            }
            if (this.state.updateUICallback) {
                this.state.updateUICallback();
            }
            this.state.requestDrawCallback();
            return;
        }

        if (this.interactionState === 'MAYBE_PAN') {
            let clientX = e.clientX;
            let clientY = e.clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }
            const dist = Math.hypot(clientX - this.panStart.x, clientY - this.panStart.y);
            if (dist > 5) {
                this.interactionState = 'PAN';
            }
        }

        if (this.interactionState === 'PAN') {
            let clientX = e.clientX;
            let clientY = e.clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }
            const dx = clientX - this.panStart.x;
            const dy = clientY - this.panStart.y;
            this.engine.viewTransform = new DOMMatrix().translate(dx, dy).multiply(this.engine.viewTransform);
            this.panStart = { x: clientX, y: clientY };
            this.state.requestDrawCallback();
        }
    }

    onPointerUp(e) {
        this.initialPinchDist = null;
        this.initialViewTransform = null;

        if (this.interactionState === 'SPLIT') {
            if (this.state.splitStart && this.state.splitEnd) {
                const p1 = this.state.splitStart;
                const p2 = this.state.splitEnd;
                const targetRoomIdx = this.state.selectedRooms[0];
                const targetRoom = this.state.rooms[targetRoomIdx];
                
                // Polybool logic wrapper here or external
                this.performRoomSplit(targetRoomIdx, p1, p2);
            }
            this.state.isSplitting = false;
            this.state.splitStart = null;
            this.state.splitEnd = null;
            this.interactionState = 'NONE';
            this.state.requestDrawCallback();
            return;
        }

        if (this.interactionState === 'DRAG_SC' || this.interactionState === 'RESIZE_SC') {
            if (this.isDragging) {
                this.state.saveState();
                this.state.updateUICallback();
            }
        }

        if (this.interactionState === 'MAYBE_PAN' && !this.isDragging) {
            const worldPos = this.getMousePos(e);
            const { bgW, bgH } = CanvasEngine.safeDimensions(this.state.bgImage);
            const pctPos = [(worldPos.x / bgW)*100, (worldPos.y / bgH)*100];
            
            let clickedIdx = -1;
            for(let i = 0; i < this.state.rooms.length; i++) {
                if (MapGeometry.isPointInPolygon(pctPos, this.state.rooms[i].polygon)) {
                    clickedIdx = i; break;
                }
            }

            if (clickedIdx !== -1) {
                if (this.state.isEditMode && (e.ctrlKey || e.metaKey)) {
                    const idx = this.state.selectedRooms.indexOf(clickedIdx);
                    if(idx === -1) this.state.selectedRooms.push(clickedIdx);
                    else this.state.selectedRooms.splice(idx, 1);
                } else {
                    this.state.selectedRooms = [clickedIdx];
                }
                this.state.selectedShortcutIdx = -1;
            } else {
                this.state.selectedRooms = [];
            }
            this.state.updateUICallback();
            this.state.requestDrawCallback();
        }

        this.interactionState = 'NONE';
        this.isDragging = false;
        this.resizeHandle = null;
    }

    onKeyDown(e) {
        if (e.key === 'Enter' && this.drawingPolygon && this.drawingPolygon.length > 2) {
            const defaultRoomColor = localStorage.getItem('lastRoomColor') || '#333333';
            this.state.rooms.push({
                id: `room_${Date.now()}`,
                name: 'New Room',
                polygon: this.drawingPolygon,
                color: defaultRoomColor
            });
            this.drawingPolygon = null;
            this.interactionState = 'NONE';
            this.state.saveState();
            this.state.requestDrawCallback();
        }
    }

    performRoomSplit(targetRoomIdx, p1, p2) {
        const targetRoom = this.state.rooms[targetRoomIdx];
        if (!targetRoom || !window.PolyBool) return;
        
        // Convert pct points back to world points for slicing logic
        const { bgW, bgH } = CanvasEngine.safeDimensions(this.state.bgImage);
        const polyWorld = targetRoom.polygon.map(pt => [(pt[0]/100)*bgW, (pt[1]/100)*bgH]);
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if(len < 10) return; 

        const nx = -dy/len;
        const ny = dx/len;
        
        const BIG = 10000;
        const sliceBox1 = [
            [p1.x - dx*BIG, p1.y - dy*BIG],
            [p1.x + nx*BIG - dx*BIG, p1.y + ny*BIG - dy*BIG],
            [p2.x + nx*BIG + dx*BIG, p2.y + ny*BIG + dy*BIG],
            [p2.x + dx*BIG, p2.y + dy*BIG]
        ];

        try {
            const pb1 = { regions: [polyWorld], inverted: false };
            const pbBox = { regions: [sliceBox1], inverted: false };
            
            const cut1 = window.PolyBool.intersect(pb1, pbBox);
            const cut2 = window.PolyBool.difference(pb1, pbBox);
            
            if(cut1.regions.length > 0 && cut2.regions.length > 0) {
                this.state.rooms.splice(targetRoomIdx, 1);
                
                const processRegion = (reg, partName) => {
                    if(MapGeometry.getPolygonArea(reg) > 2.0) {
                        const pctReg = reg.map(pt => [(pt[0]/bgW)*100, (pt[1]/bgH)*100]);
                        const roomColor = targetRoom.color || localStorage.getItem('lastRoomColor') || '#333333';
                        this.state.rooms.push({
                            id: `room_${Date.now()}_${partName}`,
                            name: `${targetRoom.name || 'Room'} Part ${partName}`,
                            polygon: pctReg,
                            color: roomColor
                        });
                    }
                };

                cut1.regions.forEach((reg, i) => processRegion(reg, `A${i}`));
                cut2.regions.forEach((reg, i) => processRegion(reg, `B${i}`));
                
                this.state.selectedRooms = [];
                this.state.saveState();
            }
        } catch(e) {
            console.error("Split failed", e);
        }
    }
}

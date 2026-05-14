import { MapGeometry } from './MapGeometry.js';

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

    bindEvents() {
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.engine.handleZoom(e.clientX, e.clientY, e.deltaY);
            this.state.requestDrawCallback();
        }, { passive: false });

        this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
        this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvas.addEventListener('pointerleave', this.onPointerUp.bind(this));
        
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
            this.drawingPolygon.push([(wp.x / this.state.bgImage.width)*100, (wp.y / this.state.bgImage.height)*100]);
            this.state.requestDrawCallback();
            return;
        }

        this.panStart = { x: clientX, y: clientY };
        this.dragStart = this.getMousePos(e);
        this.isDragging = false;
        this.resizeHandle = null;

        // Check Resize Handles
        if (this.state.selectedShortcutIdx !== -1 && this.state.shortcuts[this.state.selectedShortcutIdx]) {
            const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
            const scX = (sc.position[0]/100)*this.state.bgImage.width;
            const scY = (sc.position[1]/100)*this.state.bgImage.height;
            const rx = 12 * (sc.scaleX || sc.scale || 1);
            const ry = 12 * (sc.scaleY || sc.scale || 1);
            const currentScale = Math.hypot(this.engine.viewTransform.a, this.engine.viewTransform.b);
            const hSize = 8 / currentScale;

            const hitTest = (px, py, hx, hy) => Math.hypot(px - hx, py - hy) < hSize * 2;

            if (hitTest(this.dragStart.x, this.dragStart.y, scX - rx, scY - ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'NW'; return; }
            if (hitTest(this.dragStart.x, this.dragStart.y, scX + rx, scY - ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'NE'; return; }
            if (hitTest(this.dragStart.x, this.dragStart.y, scX - rx, scY + ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'SW'; return; }
            if (hitTest(this.dragStart.x, this.dragStart.y, scX + rx, scY + ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'SE'; return; }
            if (hitTest(this.dragStart.x, this.dragStart.y, scX, scY - ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'N'; return; }
            if (hitTest(this.dragStart.x, this.dragStart.y, scX, scY + ry)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'S'; return; }
            if (hitTest(this.dragStart.x, this.dragStart.y, scX - rx, scY)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'W'; return; }
            if (hitTest(this.dragStart.x, this.dragStart.y, scX + rx, scY)) { this.interactionState = 'RESIZE_SC'; this.resizeHandle = 'E'; return; }
        }

        let overScIdx = -1;
        for (let i = this.state.shortcuts.length - 1; i >= 0; i--) {
            const sc = this.state.shortcuts[i];
            const scX = (sc.position[0]/100)*this.state.bgImage.width;
            const scY = (sc.position[1]/100)*this.state.bgImage.height;
            const rx = 12 * (sc.scaleX || sc.scale || 1);
            const ry = 12 * (sc.scaleY || sc.scale || 1);
            
            const shape = sc.config?.shape || sc.shape || 'circle';
            if (shape === 'rect') {
                if (Math.abs(this.dragStart.x - scX) <= rx && Math.abs(this.dragStart.y - scY) <= ry) {
                    overScIdx = i; break;
                }
            } else {
                if (Math.hypot(this.dragStart.x - scX, this.dragStart.y - scY) <= Math.max(rx, ry)) {
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

            if (this.state.selectedShortcutIdx !== -1) {
                const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                const scX = (sc.position[0]/100)*this.state.bgImage.width;
                const scY = (sc.position[1]/100)*this.state.bgImage.height;
                const rx = 12 * (sc.scaleX || sc.scale || 1);
                const ry = 12 * (sc.scaleY || sc.scale || 1);
                const currentScale = Math.hypot(this.engine.viewTransform.a, this.engine.viewTransform.b);
                const hSize = 8 / currentScale;

                const hitTest = (px, py, hx, hy) => Math.hypot(px - hx, py - hy) < hSize * 2;
                
                if (hitTest(worldPos.x, worldPos.y, scX - rx, scY - ry) || hitTest(worldPos.x, worldPos.y, scX + rx, scY + ry)) {
                    cursorStyle = this.engine.isRotated ? 'nesw-resize' : 'nwse-resize';
                } else if (hitTest(worldPos.x, worldPos.y, scX + rx, scY - ry) || hitTest(worldPos.x, worldPos.y, scX - rx, scY + ry)) {
                    cursorStyle = this.engine.isRotated ? 'nwse-resize' : 'nesw-resize';
                } else if (hitTest(worldPos.x, worldPos.y, scX, scY - ry) || hitTest(worldPos.x, worldPos.y, scX, scY + ry)) {
                    cursorStyle = this.engine.isRotated ? 'ew-resize' : 'ns-resize';
                } else if (hitTest(worldPos.x, worldPos.y, scX - rx, scY) || hitTest(worldPos.x, worldPos.y, scX + rx, scY)) {
                    cursorStyle = this.engine.isRotated ? 'ns-resize' : 'ew-resize';
                }
            }

            if (cursorStyle === 'default') {
                for (let i = this.state.shortcuts.length - 1; i >= 0; i--) {
                    const sc = this.state.shortcuts[i];
                    const scX = (sc.position[0]/100)*this.state.bgImage.width;
                    const scY = (sc.position[1]/100)*this.state.bgImage.height;
                    const rx = 12 * (sc.scaleX || sc.scale || 1);
                    const ry = 12 * (sc.scaleY || sc.scale || 1);
                    
                    const shape = sc.config?.shape || sc.shape || 'circle';
                    if (shape === 'rect') {
                        if (Math.abs(worldPos.x - scX) <= rx && Math.abs(worldPos.y - scY) <= ry) {
                            overShortcut = true; break;
                        }
                    } else {
                        if (Math.hypot(worldPos.x - scX, worldPos.y - scY) <= Math.max(rx, ry)) {
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
            this.state.shortcuts[this.state.selectedShortcutIdx].position = [(worldPos.x / this.state.bgImage.width)*100, (worldPos.y / this.state.bgImage.height)*100];
            this.state.requestDrawCallback();
            return;
        }

        if (this.interactionState === 'RESIZE_SC') {
            this.isDragging = true;
            const worldPos = this.getMousePos(e);
            const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
            const scX = (sc.position[0]/100)*this.state.bgImage.width;
            const scY = (sc.position[1]/100)*this.state.bgImage.height;
            
            const dx = Math.abs(worldPos.x - scX);
            const dy = Math.abs(worldPos.y - scY);
            
            if (this.resizeHandle.includes('E') || this.resizeHandle.includes('W')) {
                sc.scaleX = Math.max(0.5, dx / 12);
                sc.scale = sc.scaleX;
            }
            if (this.resizeHandle.includes('N') || this.resizeHandle.includes('S')) {
                sc.scaleY = Math.max(0.5, dy / 12);
                sc.scale = sc.scaleY;
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
            const pctPos = [(worldPos.x / this.state.bgImage.width)*100, (worldPos.y / this.state.bgImage.height)*100];
            
            if (this.state.isEditMode) {
                let clickedIdx = -1;
                for(let i = 0; i < this.state.rooms.length; i++) {
                    if (MapGeometry.isPointInPolygon(pctPos, this.state.rooms[i].polygon)) {
                        clickedIdx = i; break;
                    }
                }

                if (clickedIdx !== -1) {
                    if (e.ctrlKey || e.metaKey) {
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
            } else {
                this.state.selectedRooms = [];
                this.state.selectedShortcutIdx = -1;
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
            this.state.rooms.push({
                id: `room_${Date.now()}`,
                name: 'New Room',
                polygon: this.drawingPolygon
            });
            this.drawingPolygon = null;
            this.interactionState = 'NONE';
            this.state.saveState();
            this.state.requestDrawCallback();
        }
    }

    performRoomSplit(targetRoomIdx, p1, p2) {
        const targetRoom = this.state.rooms[targetRoomIdx];
        if (!targetRoom || !window.polybool) return;
        
        // Convert pct points back to world points for slicing logic
        const polyWorld = targetRoom.polygon.map(pt => [(pt[0]/100)*this.state.bgImage.width, (pt[1]/100)*this.state.bgImage.height]);
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if(len < 10) return; 

        const nx = -dy/len;
        const ny = dx/len;
        
        const BIG = 10000;
        const sliceBox1 = [
            [p1.x - nx*BIG - dx*BIG, p1.y - ny*BIG - dy*BIG],
            [p1.x + nx*BIG - dx*BIG, p1.y + ny*BIG - dy*BIG],
            [p2.x + nx*BIG + dx*BIG, p2.y + ny*BIG + dy*BIG],
            [p2.x - nx*BIG + dx*BIG, p2.y - ny*BIG + dy*BIG]
        ];
        
        const sliceBox2 = [
            [p1.x - nx*BIG - dx*BIG, p1.y - ny*BIG - dy*BIG],
            [p1.x - nx*BIG + dx*BIG, p1.y - ny*BIG + dy*BIG],
            [p2.x - nx*BIG + dx*BIG, p2.y - ny*BIG + dy*BIG],
            [p2.x - nx*BIG - dx*BIG, p2.y - ny*BIG - dy*BIG]
        ];

        try {
            const pb1 = window.polybool.polygonFromSegments(window.polybool.segments({ regions: [polyWorld], inverted: false }));
            const cut1 = window.polybool.intersect(pb1, { regions: [sliceBox1], inverted: false });
            const cut2 = window.polybool.difference(pb1, { regions: [sliceBox1], inverted: false });
            
            if(cut1.regions.length > 0 && cut2.regions.length > 0) {
                this.state.rooms.splice(targetRoomIdx, 1);
                
                const processRegion = (reg, partName) => {
                    if(MapGeometry.getPolygonArea(reg) > 2.0) {
                        const pctReg = reg.map(pt => [(pt[0]/this.state.bgImage.width)*100, (pt[1]/this.state.bgImage.height)*100]);
                        this.state.rooms.push({ id: `room_${Date.now()}_${partName}`, name: `${targetRoom.name || 'Room'} Part ${partName}`, polygon: pctReg });
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

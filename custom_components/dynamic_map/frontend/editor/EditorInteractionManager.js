import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.0';
import { CanvasEngine } from './CanvasEngine.js?v=3.2.0';
import { resolvePreviewTarget, getPosition, setPosition, getScale, setScale, getRotation, setRotation } from '../shared/OrientationProps.js?v=3.2.0';

/**
 * Screen-space resize cursor for a handle at local direction (lx, ly),
 * given the shape's total on-screen rotation (deg) and view mirror (fx, fy).
 * Rotate the local direction into screen space, mirror it, then bucket the
 * angle (mod 180, since resize cursors are bidirectional) into the four CSS
 * resize cursors. Fixes cursors ignoring the shortcut's own rotation / flips.
 */
export function resizeCursorFor(lx, ly, thetaDeg, fx = 1, fy = 1) {
    const t = (thetaDeg * Math.PI) / 180;
    let sx = lx * Math.cos(t) - ly * Math.sin(t);
    let sy = lx * Math.sin(t) + ly * Math.cos(t);
    sx *= fx;
    sy *= fy;
    let a = (Math.atan2(sy, sx) * 180) / Math.PI;
    a = ((a % 180) + 180) % 180;
    if (a < 22.5 || a >= 157.5) return 'ew-resize';
    if (a < 67.5) return 'nwse-resize';
    if (a < 112.5) return 'ns-resize';
    return 'nesw-resize';
}

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
        this.state.drawingPolygon = null;

        this.bindEvents();
    }

    getMousePos(e) {
        return this.engine.getMousePos(e);
    }

    getShortcutPos(sc) {
        const activeMode = this.engine.activeMode || 'horizontal';
        const targetObj = resolvePreviewTarget(sc, this.state.previewStateIdx, 'position');
        return getPosition(targetObj, activeMode);
    }

    /** 'both' unless orientation linking was explicitly turned off in the toolbar. */
    writeMode() {
        if (this.engine.linkOrientations === false) {
            return this.engine.activeMode || 'horizontal';
        }
        return 'both';
    }

    setShortcutPos(sc, pctX, pctY) {
        const targetObj = resolvePreviewTarget(sc, this.state.previewStateIdx);
        setPosition(targetObj, this.writeMode(), pctX, pctY);
    }

    getShortcutScale(sc) {
        const activeMode = this.engine.activeMode || 'horizontal';
        const targetObj = resolvePreviewTarget(sc, this.state.previewStateIdx);
        return getScale(sc, targetObj, activeMode);
    }

    setShortcutScale(sc, prop, value) {
        const targetObj = resolvePreviewTarget(sc, this.state.previewStateIdx);
        setScale(sc, targetObj, prop, this.writeMode(), value);
    }

    getShortcutRotation(sc) {
        const activeMode = this.engine.activeMode || 'horizontal';
        const targetObj = resolvePreviewTarget(sc, this.state.previewStateIdx);
        return getRotation(sc, targetObj, activeMode);
    }

    setShortcutRotation(sc, value) {
        const targetObj = resolvePreviewTarget(sc, this.state.previewStateIdx);
        setRotation(targetObj, this.writeMode(), value);
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
            if (!this.state.drawingPolygon) this.state.drawingPolygon = [];
            const { bgW, bgH } = CanvasEngine.safeDimensions(this.state.bgImage);
            this.state.drawingPolygon.push([(wp.x / bgW)*100, (wp.y / bgH)*100]);
            this.state.requestDrawCallback();
            return;
        }

        // Vertex editing (Build Mode, single room selected):
        //  - grab a corner handle to drag it (generous hit radius)
        //  - Alt/Ctrl+click a corner to delete it (keeps >= 3 corners)
        //  - click on an edge to insert a new corner there and drag it
        if (this.state.isEditMode && this.state.selectedRooms.length === 1) {
            const wp = this.getMousePos(e);
            const { bgW: vbgW, bgH: vbgH } = CanvasEngine.safeDimensions(this.state.bgImage);
            const vScale = Math.hypot(this.engine.viewTransform.a, this.engine.viewTransform.b) || 1;
            const hitR = 18 / vScale;   // easier to grab a corner
            const roomIdx = this.state.selectedRooms[0];
            const room = this.state.rooms[roomIdx];
            const poly = room && Array.isArray(room.polygon) ? room.polygon : null;
            if (poly && poly.length) {
                // 1) corner handles
                for (let i = 0; i < poly.length; i++) {
                    const vx = (poly[i][0] / 100) * vbgW;
                    const vy = (poly[i][1] / 100) * vbgH;
                    if (Math.hypot(wp.x - vx, wp.y - vy) < hitR) {
                        if ((e.altKey || e.ctrlKey || e.metaKey) && poly.length > 3) {
                            poly.splice(i, 1);
                            this.state.saveState();
                            this.state.requestDrawCallback();
                            e.preventDefault();
                            return;
                        }
                        this.interactionState = 'DRAG_VERTEX';
                        this.state.selectedVertex = { roomIdx, vertexIdx: i };
                        e.preventDefault();
                        return;
                    }
                }
                // 2) edges -> insert a new corner at the click point and drag it
                const edgeR = 12 / vScale;
                for (let i = 0; i < poly.length; i++) {
                    const j = (i + 1) % poly.length;
                    const ax = (poly[i][0] / 100) * vbgW, ay = (poly[i][1] / 100) * vbgH;
                    const bx = (poly[j][0] / 100) * vbgW, by = (poly[j][1] / 100) * vbgH;
                    const dx = bx - ax, dy = by - ay;
                    const len2 = dx * dx + dy * dy;
                    let t = len2 ? ((wp.x - ax) * dx + (wp.y - ay) * dy) / len2 : 0;
                    t = Math.max(0, Math.min(1, t));
                    const px = ax + t * dx, py = ay + t * dy;
                    if (Math.hypot(wp.x - px, wp.y - py) < edgeR) {
                        poly.splice(j, 0, [(px / vbgW) * 100, (py / vbgH) * 100]);
                        this.interactionState = 'DRAG_VERTEX';
                        this.state.selectedVertex = { roomIdx, vertexIdx: j };
                        this.isDragging = true;
                        e.preventDefault();
                        return;
                    }
                }
            }
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
            const baseRx = sc.type === 'sensor' ? (sc._sensorHalfW || 26) : 12;
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

            // Rotation handle: the dot on a stem above the shape's top edge
            if (hitTest(checkX, checkY, scX, scY - ry - 18 / currentScale)) { this.interactionState = 'ROTATE_SC'; return; }

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
            // Only the active layer is clickable: decor never steals a click
            // from a badge sitting on top of it, and vice versa.
            const isDecor = !!(sc.config && sc.config.decor);
            if (isDecor !== (this.state.activeLayer === 'decor')) continue;
            const pos = this.getShortcutPos(sc);
            const scX = (pos[0]/100)*bgW;
            const scY = (pos[1]/100)*bgH;
            const baseRx = sc.type === 'sensor' ? (sc._sensorHalfW || 26) : 12;
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
                const baseRx = sc.type === 'sensor' ? (sc._sensorHalfW || 26) : 12;
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

                // Cursor must reflect where each handle actually points ON
                // SCREEN: fold in map rotation, the shortcut's own rotation,
                // and the active-mode view flips.
                const totalRot = ((this.engine.isRotated && !autoRotate) ? -90 : 0) + (scRotation || 0);
                const activeMode = this.engine.getActiveMode ? this.engine.getActiveMode() : 'horizontal';
                const flips = (this.engine.flips && this.engine.flips[activeMode]) || { h: false, v: false };
                let fx = 1, fy = 1;
                if (this.engine.isRotated) { if (flips.h) fy = -1; if (flips.v) fx = -1; }
                else { if (flips.h) fx = -1; if (flips.v) fy = -1; }
                const rc = (lx, ly) => resizeCursorFor(lx, ly, totalRot, fx, fy);

                if (hitTest(checkX, checkY, scX, scY - ry - 18 / currentScale)) {
                    cursorStyle = 'grab';
                } else if (hitTest(checkX, checkY, scX - rx, scY - ry) || hitTest(checkX, checkY, scX + rx, scY + ry)) {
                    cursorStyle = rc(-1, -1);
                } else if (hitTest(checkX, checkY, scX + rx, scY - ry) || hitTest(checkX, checkY, scX - rx, scY + ry)) {
                    cursorStyle = rc(1, -1);
                } else if (hitTest(checkX, checkY, scX, scY - ry) || hitTest(checkX, checkY, scX, scY + ry)) {
                    cursorStyle = rc(0, -1);
                } else if (hitTest(checkX, checkY, scX - rx, scY) || hitTest(checkX, checkY, scX + rx, scY)) {
                    cursorStyle = rc(1, 0);
                }
            }

            if (cursorStyle === 'default') {
                for (let i = this.state.shortcuts.length - 1; i >= 0; i--) {
                    const sc = this.state.shortcuts[i];
                    const isDecor = !!(sc.config && sc.config.decor);
                    if (isDecor !== (this.state.activeLayer === 'decor')) continue;
                    const pos = this.getShortcutPos(sc);
                    const scX = (pos[0]/100)*bgW;
                    const scY = (pos[1]/100)*bgH;
                    const baseRx = sc.type === 'sensor' ? (sc._sensorHalfW || 26) : 12;
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

        if (this.interactionState === 'ROTATE_SC') {
            this.isDragging = true;
            const worldPos = this.getMousePos(e);
            const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
            const { bgW, bgH } = CanvasEngine.safeDimensions(this.state.bgImage);
            const pos = this.getShortcutPos(sc);
            const scX = (pos[0] / 100) * bgW;
            const scY = (pos[1] / 100) * bgH;
            const autoRotate = sc.config?.autoRotate || false;
            let px = worldPos.x;
            let py = worldPos.y;
            if (this.engine.isRotated && !autoRotate) {
                const rDx = worldPos.x - scX;
                const rDy = worldPos.y - scY;
                px = scX - rDy;
                py = scY + rDx;
            }
            // The handle sticks out of the top edge, so mouse straight "up"
            // from the center = 0deg. Soft-snap near multiples of 15deg.
            let ang = Math.atan2(py - scY, px - scX) * 180 / Math.PI + 90;
            const snap = Math.round(ang / 15) * 15;
            if (Math.abs(ang - snap) <= 4) ang = snap;
            ang = ((Math.round(ang) % 360) + 360) % 360;
            this.setShortcutRotation(sc, ang);
            if (this.state.updateUICallback) {
                this.state.updateUICallback();
            }
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

            // Un-rotate the drag point into the shortcut's local frame (the
            // hit-test above does the same) so a rotated shape's handles pull
            // along its own axes instead of the screen's.
            const scRotation = this.getShortcutRotation(sc);
            if (scRotation) {
                const rDx = checkX - scX;
                const rDy = checkY - scY;
                const rad = (-scRotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                checkX = scX + (rDx * cos - rDy * sin);
                checkY = scY + (rDx * sin + rDy * cos);
            }

            const dx = Math.abs(checkX - scX);
            const dy = Math.abs(checkY - scY);
            
            const divisorRx = sc.type === 'sensor' ? (sc._sensorHalfW || 26) : 12;
            const divisorRy = 12;
            const shape = sc.config?.shape || sc.shape || 'circle';
            const propDefault = (shape === 'circle');
            const isUniform = sc.config?.proportional !== undefined ? sc.config.proportional : propDefault;
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

        if (this.interactionState === 'DRAG_VERTEX' && this.state.selectedVertex) {
            const wp = this.getMousePos(e);
            const { bgW, bgH } = CanvasEngine.safeDimensions(this.state.bgImage);
            const { roomIdx, vertexIdx } = this.state.selectedVertex;
            const room = this.state.rooms[roomIdx];
            if (room && room.polygon && room.polygon[vertexIdx]) {
                room.polygon[vertexIdx] = [ (wp.x / bgW) * 100, (wp.y / bgH) * 100 ];
                this.isDragging = true;
                this.state.requestDrawCallback();
            }
            e.preventDefault();
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

        if (this.interactionState === 'DRAG_SC' || this.interactionState === 'RESIZE_SC' || this.interactionState === 'ROTATE_SC' || this.interactionState === 'DRAG_VERTEX') {
            if (this.isDragging) {
                this.state.saveState();
                this.state.updateUICallback();
            }
            this.state.selectedVertex = null;
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
        if (e.key === 'Enter' && this.state.drawingPolygon && this.state.drawingPolygon.length > 2) {
            // Reject a degenerate (zero-area) polygon rather than creating an invalid room
            if (EditorInteractionManager.polygonArea(this.state.drawingPolygon) < 1e-6) {
                this.state.drawingPolygon = null;
                this.interactionState = 'NONE';
                this.state.requestDrawCallback();
                return;
            }
            const defaultRoomColor = localStorage.getItem('lastRoomColor') || '#333333';
            this.state.rooms.push({
                id: `room_${Date.now()}`,
                name: 'New Room',
                polygon: this.state.drawingPolygon,
                color: defaultRoomColor
            });
            this.state.drawingPolygon = null;
            this.interactionState = 'NONE';
            // Auto-select the new room so its Name/Area panel opens immediately
            this.state.selectedRooms = [this.state.rooms.length - 1];
            this.state.selectedShortcutIdx = -1;
            this.state.saveState();
            if (this.state.updateUICallback) this.state.updateUICallback();
            this.state.requestDrawCallback();
        } else if (e.key === 'Escape' && this.state.drawingPolygon) {
            // Cancel an in-progress room drawing
            this.state.drawingPolygon = null;
            this.interactionState = 'NONE';
            this.state.requestDrawCallback();
        }
    }

    // Shoelace area of a polygon given as [[x%,y%], ...]; used to reject degenerate rooms.
    static polygonArea(poly) {
        if (!Array.isArray(poly) || poly.length < 3) return 0;
        let a = 0;
        for (let i = 0, n = poly.length; i < n; i++) {
            const [x1, y1] = poly[i];
            const [x2, y2] = poly[(i + 1) % n];
            a += x1 * y2 - x2 * y1;
        }
        return Math.abs(a) / 2;
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

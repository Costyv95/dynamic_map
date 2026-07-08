import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.0';
import { resolveOriented, getPosition } from '../shared/OrientationProps.js?v=3.2.0';
import { computeSensorPill } from '../shared/SensorPill.js?v=3.2.0';

export class CanvasEngine {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.viewTransform = new DOMMatrix();
        this.defaultTransform = new DOMMatrix();
        this.minScale = 0.1;
        this.isRotated = false;
        this.rotationMode = 'auto'; // 'auto', 'horizontal', 'vertical'
        this.activeMode = 'horizontal';
        this.flips = {
            horizontal: { h: false, v: false },
            vertical: { h: false, v: false }
        };
        this.animationFrameId = null;
    }

    /**
     * Returns safe pixel dimensions for a background image, preferring
     * naturalWidth/naturalHeight (which are always accurate for loaded images)
     * over the DOM-layout .width/.height (which can be 0 in iframe/shadow-DOM contexts).
     */
    static safeDimensions(bgImage) {
        const bgW = bgImage.naturalWidth || bgImage.width || 1;
        const bgH = bgImage.naturalHeight || bgImage.height || 1;
        return { bgW, bgH };
    }

    resizeCanvas(state) {
        const container = this.canvas.parentElement || document.getElementById('canvas-container');
        if (container) {
            const dpr = window.devicePixelRatio || 1;
            const targetWidth = Math.floor(container.clientWidth * dpr);
            const targetHeight = Math.floor(container.clientHeight * dpr);

            if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
                this.canvas.width = targetWidth;
                this.canvas.height = targetHeight;
                this.canvas.style.width = container.clientWidth + 'px';
                this.canvas.style.height = container.clientHeight + 'px';
                if (state && state.bgImage && state.bgImage.complete && state.rooms && state.rooms.length > 0) {
                    this.calculateAutoCrop(state.bgImage, state.rooms, true);
                }
            }
        }
    }

    calculateAutoCrop(bgImage, rooms, forceRecalculate = false) {
        if (!this.cachedBounds || forceRecalculate) {
            let minPctX = 100, maxPctX = 0, minPctY = 100, maxPctY = 0;
            rooms.forEach(r => {
                r.polygon.forEach(pt => {
                    if(pt[0] < minPctX) minPctX = pt[0];
                    if(pt[0] > maxPctX) maxPctX = pt[0];
                    if(pt[1] < minPctY) minPctY = pt[1];
                    if(pt[1] > maxPctY) maxPctY = pt[1];
                });
            });
            this.cachedBounds = { minPctX, maxPctX, minPctY, maxPctY };
        }

        const { minPctX, maxPctX, minPctY, maxPctY } = this.cachedBounds;
        const { bgW, bgH } = CanvasEngine.safeDimensions(bgImage);

        const minX = (minPctX / 100) * bgW;
        const maxX = (maxPctX / 100) * bgW;
        const minY = (minPctY / 100) * bgH;
        const maxY = (maxPctY / 100) * bgH;
        
        const w = maxX - minX;
        const h = maxY - minY;
        
        if (w < 1 || h < 1) return;

        const mapRatio = w / h;
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = this.canvas.width / dpr;
        const cssHeight = this.canvas.height / dpr;

        const screenRatio = cssWidth / cssHeight;
        
        if (this.rotationMode === 'auto') {
            this.isRotated = (mapRatio > 1 && screenRatio < 1) || (mapRatio < 1 && screenRatio > 1);
        } else if (this.rotationMode === 'horizontal') {
            this.isRotated = mapRatio < 1; 
        } else if (this.rotationMode === 'vertical') {
            this.isRotated = mapRatio > 1; 
        }

        let viewW = this.isRotated ? h : w;
        let viewH = this.isRotated ? w : h;

        const zoomX = (cssWidth * 0.92) / viewW;
        const zoomY = (cssHeight * 0.92) / viewH;
        this.minScale = Math.min(zoomX, zoomY);
        
        const cx = minX + w/2;
        const cy = minY + h/2;
        
        this.defaultTransform = new DOMMatrix();
        this.defaultTransform.translateSelf(cssWidth / 2, cssHeight / 2);
        this.defaultTransform.scaleSelf(this.minScale);
        if (this.isRotated) this.defaultTransform.rotateSelf(90);
        
        const isMapLandscape = w > h;
        const finalIsHorizontal = isMapLandscape !== this.isRotated;
        this.activeMode = finalIsHorizontal ? 'horizontal' : 'vertical';
        
        const currentFlips = this.flips[this.activeMode];
        let sx = 1, sy = 1;
        if (this.isRotated) {
            if (currentFlips.h) sy = -1;
            if (currentFlips.v) sx = -1;
        } else {
            if (currentFlips.h) sx = -1;
            if (currentFlips.v) sy = -1;
        }
        this.defaultTransform.scaleSelf(sx, sy);
        
        this.defaultTransform.translateSelf(-cx, -cy);

        this.viewTransform = new DOMMatrix(this.defaultTransform);
    }
    
    getActiveMode() {
        return this.activeMode;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        
        let clientX, clientY;
        if (e.clientX !== undefined) {
            clientX = e.clientX;
            clientY = e.clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            return { x: 0, y: 0 };
        }
        
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;

        const inverse = this.viewTransform.inverse();
        const pt = new DOMPoint(screenX, screenY).matrixTransform(inverse);
        return { x: pt.x, y: pt.y };
    }

    handleZoom(clientX, clientY, deltaY) {
        const zoomFactor = 1 - (deltaY * 0.001);
        
        const rect = this.canvas.getBoundingClientRect();
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;

        const newTransform = new DOMMatrix().translate(screenX, screenY).scale(zoomFactor).translate(-screenX, -screenY).multiply(this.viewTransform);
        
        const currentScale = Math.hypot(newTransform.a, newTransform.b);

        if (currentScale <= this.minScale * 1.02 && zoomFactor < 1) {
            this.viewTransform = new DOMMatrix(this.defaultTransform);
        } else {
            this.viewTransform = newTransform;
        }
    }

    draw(state) {
        const {
            bgImage, rooms, selectedRooms, isSplitting, splitStart, splitEnd,
            shortcuts, selectedShortcutIdx, previewStateIdx, isTransitioning,
            isEditMode, drawingPolygon, requestDraw
        } = state;

        if(!bgImage.complete || isTransitioning) {
            return;
        }

        this.resizeCanvas(state);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const { bgW, bgH } = CanvasEngine.safeDimensions(bgImage);
        
        const dpr = window.devicePixelRatio || 1;
        this.ctx.save();
        this.ctx.setTransform(new DOMMatrix().scale(dpr).multiply(this.viewTransform));
        this.ctx.drawImage(bgImage, 0, 0, bgW, bgH);
        
        const time = Date.now();
        const borderPulse = 6 + Math.sin(time / 200) * 3;

        // Draw Polygons
        rooms.forEach((room, idx) => {
            this.ctx.beginPath();
            room.polygon.forEach((pt, i) => {
                const x = (pt[0] / 100) * bgW;
                const y = (pt[1] / 100) * bgH;
                if(i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.closePath();

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

            const hue = (idx * 137.5) % 360;
            
            if(selectedRooms.includes(idx)) {
                this.ctx.fillStyle = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)` : `hsla(${hue}, 100%, 50%, 0.5)`;
                this.ctx.strokeStyle = '#00ffff';
                this.ctx.lineWidth = borderPulse;
                this.ctx.shadowColor = '#00ffff';
                this.ctx.shadowBlur = 15;
            } else {
                this.ctx.fillStyle = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)` : `hsla(${hue}, 100%, 50%, 0.4)`;
                this.ctx.strokeStyle = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)` : `hsla(${hue}, 100%, 50%, 0.8)`;
                this.ctx.lineWidth = 2;
            }
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            if(room.name) {
                const center = MapGeometry.getPolygonCenter(room.polygon);
                const textX = (center[0]/100)*bgW;
                const textY = (center[1]/100)*bgH;
                
                this.ctx.save();
                const pt = new DOMPoint(textX, textY).matrixTransform(this.viewTransform);
                const dpr = window.devicePixelRatio || 1;
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                this.ctx.translate(pt.x, pt.y);
                
                const currentScale = Math.hypot(this.viewTransform.a, this.viewTransform.b);
                
                this.ctx.font = `900 ${20 * currentScale}px sans-serif`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 5 * currentScale;
                this.ctx.strokeText(room.name, 0, 0);
                this.ctx.fillStyle = 'white';
                this.ctx.fillText(room.name, 0, 0);
                this.ctx.restore();
            }

            // Vertex handles for the single selected room in edit mode (Builder Mode)
            if (isEditMode && selectedRooms.length === 1 && selectedRooms[0] === idx) {
                const vScale = Math.hypot(this.viewTransform.a, this.viewTransform.b) || 1;
                const r = 8 / vScale;
                room.polygon.forEach((pt) => {
                    const hx = (pt[0] / 100) * bgW;
                    const hy = (pt[1] / 100) * bgH;
                    this.ctx.beginPath();
                    this.ctx.arc(hx, hy, r, 0, Math.PI * 2);
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.strokeStyle = '#00ffff';
                    this.ctx.lineWidth = 2.5 / vScale;
                    this.ctx.fill();
                    this.ctx.stroke();
                });
            }
        });

        // Live preview of a polygon being drawn (Build Mode, before Enter closes it)
        if (drawingPolygon && drawingPolygon.length > 0) {
            const vScale = Math.hypot(this.viewTransform.a, this.viewTransform.b) || 1;
            const pts = drawingPolygon.map(p => [ (p[0] / 100) * bgW, (p[1] / 100) * bgH ]);
            if (pts.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i][0], pts[i][1]);
                this.ctx.strokeStyle = '#00ffaa';
                this.ctx.lineWidth = 2 / vScale;
                this.ctx.setLineDash([8 / vScale, 6 / vScale]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
            const r = 7 / vScale;
            pts.forEach((p, i) => {
                this.ctx.beginPath();
                this.ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
                this.ctx.fillStyle = i === 0 ? '#00ffaa' : '#ffffff';
                this.ctx.strokeStyle = '#00ffaa';
                this.ctx.lineWidth = 2 / vScale;
                this.ctx.fill();
                this.ctx.stroke();
            });
        }

        if(isSplitting && splitStart && splitEnd) {
            this.ctx.beginPath();
            this.ctx.moveTo(splitStart.x, splitStart.y);
            this.ctx.lineTo(splitEnd.x, splitEnd.y);
            this.ctx.strokeStyle = '#ff00ff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        shortcuts.forEach((sc, idx) => {
            const activeMode = this.activeMode || 'horizontal';
            const pos = getPosition(sc, activeMode);

            const x = (pos[0] / 100) * bgW;
            const y = (pos[1] / 100) * bgH;
            // Let's resolve targetState:
            let targetState = null;
            if (idx === selectedShortcutIdx && previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
                targetState = sc.config.states[previewStateIdx];
            } else if (sc.config?.states && sc.config.states.length > 0) {
                targetState = sc.config.states.find(s => s.is_default) || null;
            }

            const resolveProperty = (prop, defaultVal) => {
                let val = targetState?.[prop];
                if (val === undefined) {
                    val = sc[prop] !== undefined ? sc[prop] : sc.config?.[prop];
                }
                return resolveOriented(val, activeMode, defaultVal);
            };

            let scScale = resolveProperty('scale', 1.0);
            let scaleX = resolveProperty('scaleX', scScale);
            let scaleY = resolveProperty('scaleY', scScale);
            let scRotation = resolveProperty('rotation', 0);
            
            let shape = resolveProperty('shape', (sc.type === 'sensor' ? 'rect' : 'circle'));
            const propDefault = (shape === 'circle');
            const isProportional = resolveProperty('proportional', propDefault);
            if (isProportional) {
                scaleY = scaleX;
            }
            
            let color = resolveProperty('color', '#0ea5e9');
            let isTrans = resolveProperty('transparent', false);
            let icon = resolveProperty('icon', '💡');
            let image = resolveProperty('image', '');
            let autoRotate = resolveProperty('autoRotate', false);

            if (targetState) {
                if (targetState.color) color = targetState.color;
                if (targetState.image) {
                    image = targetState.image;
                    icon = targetState.icon || '';
                } else if (targetState.icon) {
                    icon = targetState.icon;
                    image = '';
                }
            }

            const finalImage = image || (icon && (icon.startsWith('http') || icon.startsWith('/') || icon.endsWith('.png') || icon.endsWith('.svg') || icon.endsWith('.jpg') || icon.endsWith('.webp')) ? icon : '');

            if (idx === selectedShortcutIdx && previewStateIdx !== -1) {
                if (!this._lastLoggedPreview || this._lastLoggedPreview.selectedShortcutIdx !== selectedShortcutIdx || this._lastLoggedPreview.previewStateIdx !== previewStateIdx) {
                    this._lastLoggedPreview = { selectedShortcutIdx, previewStateIdx };
                    const st = sc.config?.states?.[previewStateIdx];
                    let cachedStatus = 'none';
                    if (sc._imgCache && sc._imgCache[finalImage]) {
                        const ci = sc._imgCache[finalImage];
                        cachedStatus = `complete=${ci.complete}, naturalWidth=${ci.naturalWidth}, failed=${ci._failed}`;
                    }
                    console.log(`[DynamicMapDebug] CanvasEngine selected shortcut preview info:`, {
                        entity: sc.entity_id || '',
                        stateIdx: previewStateIdx,
                        stateName: st?.name || '',
                        baseImage: sc.config?.image || '',
                        baseIcon: sc.config?.icon || '',
                        overrideImage: st?.image || '',
                        overrideIcon: st?.icon || '',
                        resolvedFinalImage: finalImage,
                        cacheStatus: cachedStatus,
                        scType: sc.type || 'generic'
                    });
                }
            } else if (idx === selectedShortcutIdx) {
                this._lastLoggedPreview = null;
            }

            // Sensor pills share their geometry/content resolution with the
            // dashboard card via SensorPill — one source of truth, no drift.
            let pill = null;
            if (sc.type === 'sensor') {
                let previewState = null;
                if (idx === selectedShortcutIdx && previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
                    previewState = sc.config.states[previewStateIdx];
                } else if (sc.config?.states && sc.config.states.length > 0) {
                    previewState = sc.config.states[0];
                }
                pill = computeSensorPill({ sc, state: previewState, hass: null, scaleX, scaleY });
                color = pill.color;
                isTrans = pill.transparent;
                // Expose the real half-width (in pre-scale units) so hit-testing
                // and resize in EditorInteractionManager track the rendered pill.
                sc._sensorHalfW = pill.width / 2 / (scaleX || 1);
            }

            let rx = 12 * scaleX;
            let ry = 12 * scaleY;
            if (pill) {
                rx = pill.width / 2;
                ry = pill.height / 2;
            }
            const r = Math.max(rx, ry);

            this.ctx.save();
            if (!autoRotate && this.isRotated) {
                this.ctx.translate(x, y);
                this.ctx.rotate(-Math.PI / 2);
                this.ctx.translate(-x, -y);
            }
            if (scRotation) {
                this.ctx.translate(x, y);
                this.ctx.rotate((scRotation * Math.PI) / 180);
                this.ctx.translate(-x, -y);
            }
            this.ctx.beginPath();
            if (pill) {
                if (this.ctx.roundRect) {
                    this.ctx.roundRect(x - rx, y - ry, rx * 2, ry * 2, pill.rx);
                } else {
                    this.ctx.rect(x - rx, y - ry, rx * 2, ry * 2);
                }
            } else if (shape === 'rect') {
                this.ctx.rect(x - rx, y - ry, rx*2, ry*2);
            } else {
                if (this.ctx.ellipse && rx !== ry) {
                    this.ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2);
                } else {
                    this.ctx.arc(x, y, rx, 0, Math.PI*2);
                }
            }

            if (idx === selectedShortcutIdx) {
                this.ctx.fillStyle = isTrans ? 'rgba(0,0,0,0)' : color;
                this.ctx.shadowColor = '#0ea5e9';
                this.ctx.shadowBlur = 10;
                this.ctx.strokeStyle = '#0ea5e9';
                this.ctx.lineWidth = 3;
            } else {
                this.ctx.fillStyle = isTrans ? 'rgba(0,0,0,0)' : color;
                this.ctx.shadowBlur = 0;
                this.ctx.strokeStyle = isTrans ? 'rgba(0,0,0,0)' : 'white';
                this.ctx.lineWidth = 2;
            }
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            
            if (idx === selectedShortcutIdx) {
                const currentScale = Math.hypot(this.viewTransform.a, this.viewTransform.b);
                const hSize = 4 / currentScale;
                this.ctx.fillStyle = 'white';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 1 / currentScale;

                const drawHandle = (hx, hy) => {
                    this.ctx.fillRect(hx - hSize, hy - hSize, hSize*2, hSize*2);
                    this.ctx.strokeRect(hx - hSize, hy - hSize, hSize*2, hSize*2);
                };

                drawHandle(x, y - ry);
                drawHandle(x, y + ry);
                drawHandle(x - rx, y);
                drawHandle(x + rx, y);
                drawHandle(x - rx, y - ry);
                drawHandle(x + rx, y - ry);
                drawHandle(x - rx, y + ry);
                drawHandle(x + rx, y + ry);

                // Rotation handle: a dot on a stem above the top edge; drag
                // it to rotate the shortcut (drawn in the rotated frame so it
                // tracks the shape).
                const rotOff = 18 / currentScale;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y - ry);
                this.ctx.lineTo(x, y - ry - rotOff);
                this.ctx.strokeStyle = '#0ea5e9';
                this.ctx.lineWidth = 1.5 / currentScale;
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.arc(x, y - ry - rotOff, hSize * 1.4, 0, Math.PI * 2);
                this.ctx.fillStyle = '#0ea5e9';
                this.ctx.fill();
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 1 / currentScale;
                this.ctx.stroke();
            }
            this.ctx.restore();

            if (sc.type === 'vacuum') {
                const maxR = shape === 'rect' ? Math.min(rx, ry) : rx;
                this.ctx.beginPath(); this.ctx.arc(x, y, maxR*0.8, 0, Math.PI*2); this.ctx.fillStyle = '#334155'; this.ctx.fill();
                this.ctx.beginPath(); this.ctx.arc(x, y, maxR*0.4, 0, Math.PI*2); this.ctx.fillStyle = '#0ea5e9'; this.ctx.fill();
                this.ctx.beginPath(); this.ctx.arc(x + maxR*0.5, y, maxR*0.15, 0, Math.PI*2); this.ctx.fillStyle = '#10b981'; this.ctx.fill();
            } else {
                this.ctx.save();
                const pt = new DOMPoint(x, y).matrixTransform(this.viewTransform);
                const dpr = window.devicePixelRatio || 1;
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                this.ctx.translate(pt.x, pt.y);
                
                const currentScale = Math.hypot(this.viewTransform.a, this.viewTransform.b);

                if (scRotation) {
                    this.ctx.rotate((scRotation * Math.PI) / 180);
                }
                
                // Resolve target config for content matching options
                const targetConfig = targetState || sc.config || {};
                const contentMatchSize = targetConfig.content_matchSize !== undefined ? !!targetConfig.content_matchSize : (sc.config?.content_matchSize !== undefined ? !!sc.config.content_matchSize : true);
                const contentMatchRot = targetConfig.content_matchRotation !== undefined ? !!targetConfig.content_matchRotation : (sc.config?.content_matchRotation !== undefined ? !!sc.config.content_matchRotation : true);
                
                const contentX = targetConfig.content_x !== undefined ? targetConfig.content_x : (sc.config?.content_x !== undefined ? sc.config.content_x : 0);
                const contentY = targetConfig.content_y !== undefined ? targetConfig.content_y : (sc.config?.content_y !== undefined ? sc.config.content_y : 0);
                const contentScaleX = contentMatchSize ? 1.0 : (targetConfig.content_scaleX !== undefined ? targetConfig.content_scaleX : (sc.config?.content_scaleX !== undefined ? sc.config.content_scaleX : 1.0));
                const contentScaleY = contentMatchSize ? 1.0 : (targetConfig.content_scaleY !== undefined ? targetConfig.content_scaleY : (sc.config?.content_scaleY !== undefined ? sc.config.content_scaleY : 1.0));
                const contentRotation = contentMatchRot ? 0 : (targetConfig.content_rotation !== undefined ? targetConfig.content_rotation : (sc.config?.content_rotation !== undefined ? sc.config.content_rotation : 0));

                let totalContentRotation = 0;
                if (!contentMatchRot) {
                    totalContentRotation = -scRotation;
                    if (autoRotate && this.isRotated) {
                        totalContentRotation -= 90;
                    }
                    totalContentRotation += contentRotation;
                }

                // Apply content offset translations (scaled by current zoom scale)
                if (contentX !== 0 || contentY !== 0) {
                    this.ctx.translate(contentX * currentScale, contentY * currentScale);
                }
                
                // Apply content rotation
                if (totalContentRotation !== 0) {
                    this.ctx.rotate((totalContentRotation * Math.PI) / 180);
                }
                
                // Apply content scale
                if (!contentMatchSize && (contentScaleX !== 1.0 || contentScaleY !== 1.0)) {
                    this.ctx.scale(contentScaleX, contentScaleY);
                }
                
                if (pill) {
                    // Icon and value use the shared flow layout: the icon sits
                    // centered in its left slot, the value is left-aligned after
                    // it — same geometry as the dashboard card, no overlap.
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillStyle = pill.fg;

                    this.ctx.font = `${pill.fontIcon * currentScale}px sans-serif`;
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(pill.icon, pill.iconX * currentScale, 0);

                    this.ctx.font = `bold ${pill.fontValue * currentScale}px sans-serif`;
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText(pill.value, pill.textX * currentScale, 0);
                } else {
                    const isUrlFn = (str) => str && (str.startsWith('http') || str.startsWith('/') || str.endsWith('.png') || str.endsWith('.svg') || str.endsWith('.jpg') || str.endsWith('.webp'));
                    let fallbackIcon = '💡';
                    if (idx === selectedShortcutIdx && previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
                        const st = sc.config.states[previewStateIdx];
                        if (st.icon && !isUrlFn(st.icon)) {
                            fallbackIcon = st.icon;
                        } else if (sc.config?.icon && !isUrlFn(sc.config.icon)) {
                            fallbackIcon = sc.config.icon;
                        }
                    } else if (sc.config?.icon && !isUrlFn(sc.config.icon)) {
                        fallbackIcon = sc.config.icon;
                    }

                    if (finalImage) {
                        if (!sc._imgCache) sc._imgCache = {};
                        let cachedImg = sc._imgCache[finalImage];
                        
                        if (cachedImg && !(cachedImg instanceof Image) && typeof cachedImg.src !== 'string') {
                            console.log(`[DynamicMapDebug] CanvasEngine invalid cached image detected for: "${finalImage}", clearing cache`);
                            delete sc._imgCache[finalImage];
                            cachedImg = null;
                        }

                        if (cachedImg && cachedImg._failed && (Date.now() - (cachedImg._lastFailureTime || 0) > 15000)) {
                            console.log(`[DynamicMapDebug] CanvasEngine retry cooldown elapsed for: "${finalImage}"`);
                            delete sc._imgCache[finalImage];
                            cachedImg = null;
                        }

                        if (!cachedImg) {
                            console.log(`[DynamicMapDebug] CanvasEngine creating new Image for: "${finalImage}"`);
                            const img = new Image();
                            img._failed = false;
                            img.onload = () => {
                                console.log(`[DynamicMapDebug] CanvasEngine Image LOADED successfully: "${finalImage}"`);
                                if (requestDraw) requestDraw();
                            };
                            img.onerror = (err) => {
                                console.error(`[DynamicMapDebug] CanvasEngine Image FAILED to load for: "${finalImage}"`, err);
                                img._failed = true;
                                img._lastFailureTime = Date.now();
                                if (requestDraw) requestDraw();
                            };
                            img.src = finalImage;
                            sc._imgCache[finalImage] = img;
                            cachedImg = img;
                        }

                        if (cachedImg.complete && cachedImg.naturalWidth > 0 && !cachedImg._failed) {
                            let imgW = contentMatchSize ? (rx * 2 * currentScale) : (24 * currentScale);
                            let imgH = contentMatchSize ? (ry * 2 * currentScale) : (24 * currentScale);
                            const tilingCfg = targetConfig.image_tiling !== undefined ? targetConfig.image_tiling : sc.config?.image_tiling;
                            if (tilingCfg) {
                                // Same tiling the card renders: square tiles on the
                                // short side ('axis', rotated when the strip stands
                                // vertically) or a 2D grid ('both').
                                const tsCfg = targetConfig.image_tile_size !== undefined ? targetConfig.image_tile_size : sc.config?.image_tile_size;
                                const tile = Math.max(2, Number(tsCfg) > 0 ? Number(tsCfg) * currentScale : Math.min(imgW, imgH));
                                const vertical = tilingCfg !== 'both' && imgH > imgW;
                                this.ctx.save();
                                this.ctx.beginPath();
                                this.ctx.rect(-imgW / 2, -imgH / 2, imgW, imgH);
                                this.ctx.clip();
                                if (tilingCfg === 'both') {
                                    for (let ty = -imgH / 2; ty < imgH / 2; ty += tile) {
                                        for (let tx = -imgW / 2; tx < imgW / 2; tx += tile) {
                                            this.ctx.drawImage(cachedImg, tx, ty, tile, tile);
                                        }
                                    }
                                } else if (vertical) {
                                    for (let ty = -imgH / 2; ty < imgH / 2; ty += tile) {
                                        this.ctx.save();
                                        this.ctx.translate(0, ty + tile / 2);
                                        this.ctx.rotate(Math.PI / 2);
                                        this.ctx.drawImage(cachedImg, -tile / 2, -tile / 2, tile, tile);
                                        this.ctx.restore();
                                    }
                                } else {
                                    for (let tx = -imgW / 2; tx < imgW / 2; tx += tile) {
                                        this.ctx.drawImage(cachedImg, tx, -imgH / 2, tile, tile);
                                    }
                                }
                                this.ctx.restore();
                            } else {
                                this.ctx.drawImage(cachedImg, -imgW/2, -imgH/2, imgW, imgH);
                            }
                        } else if (cachedImg._failed) {
                            this.ctx.font = `${14 * Math.min(scaleX, scaleY) * currentScale}px sans-serif`;
                            this.ctx.textBaseline = 'middle';
                            this.ctx.textAlign = 'center';
                            this.ctx.fillStyle = isTrans ? color : 'white';
                            this.ctx.fillText(fallbackIcon, 0, 0);
                        }
                    } else {
                        this.ctx.font = `${14 * Math.min(scaleX, scaleY) * currentScale}px sans-serif`;
                        this.ctx.textBaseline = 'middle';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillStyle = isTrans ? color : 'white';
                        this.ctx.fillText(fallbackIcon, 0, 0);
                    }
                }
                this.ctx.restore();
            }

            if (idx === selectedShortcutIdx) {
                this.ctx.save();
                const pt = new DOMPoint(x, y).matrixTransform(this.viewTransform);
                const dpr = window.devicePixelRatio || 1;
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                this.ctx.translate(pt.x, pt.y);
                
                const currentScale = Math.hypot(this.viewTransform.a, this.viewTransform.b);

                this.ctx.font = `${10 * currentScale}px sans-serif`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'top';
                this.ctx.fillStyle = '#1e293b';
                this.ctx.shadowColor = 'white';
                this.ctx.shadowBlur = 4 * currentScale;
                this.ctx.fillText(sc.name || 'Shortcut', 0, (r + 4) * currentScale);
                this.ctx.shadowBlur = 0;
                this.ctx.restore();
            }
        });
        
        this.ctx.restore();
    }
}

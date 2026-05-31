import { MapGeometry } from '../shared/MapGeometry.js?v=2.74';

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

        const zoomX = (cssWidth * 0.75) / viewW;
        const zoomY = (cssHeight * 0.75) / viewH;
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
            requestDraw
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
        });

        if(isSplitting && splitStart && splitEnd) {
            this.ctx.beginPath();
            this.ctx.moveTo(splitStart.x, splitStart.y);
            this.ctx.lineTo(splitEnd.x, splitEnd.y);
            this.ctx.strokeStyle = '#ff00ff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        shortcuts.forEach((sc, idx) => {
            const x = (sc.position[0] / 100) * bgW;
            const y = (sc.position[1] / 100) * bgH;
            let scaleX = sc.scaleX || sc.scale || 1;
            let scaleY = sc.scaleY || sc.scale || 1;
            
            let shape = sc.config?.shape || sc.shape || 'circle';
            let color = sc.config?.color || sc.color || '#0ea5e9';
            let isTrans = sc.config?.transparent || sc.transparent || false;
            let icon = sc.config?.icon || '💡';
            let image = sc.config?.image || '';

            let autoRotate = false;
            if (idx === selectedShortcutIdx && previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
                const st = sc.config.states[previewStateIdx];
                autoRotate = st.autoRotate !== undefined ? st.autoRotate : (sc.config?.autoRotate || false);
            } else {
                autoRotate = sc.config?.autoRotate || false;
            }

            if (autoRotate && this.isRotated) {
                const temp = scaleX;
                scaleX = scaleY;
                scaleY = temp;
            }

            if (idx === selectedShortcutIdx && previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
                const st = sc.config.states[previewStateIdx];
                if (st.color) color = st.color;
                if (st.image) {
                    image = st.image;
                    icon = st.icon || '';
                } else if (st.icon) {
                    icon = st.icon;
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

            let rx = 12 * scaleX;
            let ry = 12 * scaleY;
            if (sc.type === 'sensor') {
                rx = 26 * scaleX;
                ry = 12 * scaleY;
            }
            const r = Math.max(rx, ry);

            this.ctx.beginPath();
            if (sc.type === 'sensor') {
                const borderRadius = 8 * Math.min(scaleX, scaleY);
                if (this.ctx.roundRect) {
                    this.ctx.roundRect(x - rx, y - ry, rx * 2, ry * 2, borderRadius);
                } else {
                    this.ctx.rect(x - rx, y - ry, rx * 2, ry * 2);
                }
            } else if (shape === 'rect') {
                this.ctx.rect(x - rx, y - ry, rx*2, ry*2);
            } else {
                this.ctx.arc(x, y, rx, 0, Math.PI*2);
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
            }

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
                
                if (autoRotate && this.isRotated) {
                    this.ctx.rotate(Math.PI / 2);
                }
                
                const currentScale = Math.hypot(this.viewTransform.a, this.viewTransform.b);
                
                if (sc.type === 'sensor') {
                    // Resolve comfort icon and guessed value
                    let valText = '--';
                    let activeIcon = icon;
                    let activeColor = color;
                    
                    let activeState = null;
                    if (idx === selectedShortcutIdx && previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
                        activeState = sc.config.states[previewStateIdx];
                    } else if (sc.config?.states && sc.config.states.length > 0) {
                        activeState = sc.config.states[0];
                    }
                    
                    if (activeState) {
                        if (activeState.color) activeColor = activeState.color;
                        if (activeState.icon) activeIcon = activeState.icon;
                        
                        const unit = activeState.unit !== undefined ? activeState.unit : '°';
                        let guessedVal = null;
                        
                        // Parse conditions
                        const conds = activeState.conditions || [];
                        for (const cond of conds) {
                            const op = cond.operator || '==';
                            const target = cond.value;
                            if (op === '==' && !isNaN(parseFloat(target))) {
                                guessedVal = parseFloat(target);
                            } else if (op === '<') {
                                guessedVal = parseFloat(target) - 1;
                            } else if (op === '<=') {
                                guessedVal = parseFloat(target);
                            } else if (op === '>') {
                                guessedVal = parseFloat(target) + 1;
                            } else if (op === '>=') {
                                guessedVal = parseFloat(target);
                            } else if (op === 'between') {
                                const parts = String(target).split('-');
                                if (parts.length === 2) {
                                    const min = parseFloat(parts[0]);
                                    const max = parseFloat(parts[1]);
                                    if (!isNaN(min) && !isNaN(max)) {
                                        guessedVal = Math.round((min + max) / 2);
                                    }
                                }
                            }
                        }
                        
                        if (guessedVal !== null && !isNaN(guessedVal)) {
                            valText = `${guessedVal}${unit}`;
                        } else {
                            valText = `21${unit}`;
                        }
                    } else {
                        activeIcon = sc.config?.icon || '🌡️';
                        valText = '21°';
                    }

                    // Draw comfort icon on the left
                    this.ctx.font = `${12 * Math.min(scaleX, scaleY) * currentScale}px sans-serif`;
                    this.ctx.textBaseline = 'middle';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillStyle = isTrans ? activeColor : 'white';
                    
                    const iconX = -12 * scaleX * currentScale;
                    this.ctx.fillText(activeIcon, iconX, 0);

                    // Draw formatted value text on the right
                    this.ctx.font = `bold ${11 * Math.min(scaleX, scaleY) * currentScale}px sans-serif`;
                    this.ctx.textBaseline = 'middle';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillStyle = isTrans ? activeColor : 'white';
                    
                    const textX = 8 * scaleX * currentScale;
                    this.ctx.fillText(valText, textX, 0);
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
                            const dim = 20 * Math.min(scaleX, scaleY) * currentScale;
                            this.ctx.drawImage(cachedImg, -dim/2, -dim/2, dim, dim);
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

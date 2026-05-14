import { getPolygonCenter } from './editorUtils.js?v=2.63';

export class CanvasEngine {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.viewTransform = new DOMMatrix();
        this.defaultTransform = new DOMMatrix();
        this.minScale = 0.1;
        this.isRotated = false;
        this.rotationMode = 'auto'; // 'auto', 'horizontal', 'vertical'
        this.flips = {
            horizontal: { h: false, v: false },
            vertical: { h: false, v: false }
        };
        this.animationFrameId = null;
    }

    resizeCanvas(state) {
        const container = this.canvas.parentElement || document.getElementById('canvas-container');
        if (container && (this.canvas.width !== container.clientWidth || this.canvas.height !== container.clientHeight)) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            if (state && state.bgImage && state.bgImage.complete && state.rooms && state.rooms.length > 0) {
                this.calculateAutoCrop(state.bgImage, state.rooms);
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

        const minX = (minPctX / 100) * bgImage.width;
        const maxX = (maxPctX / 100) * bgImage.width;
        const minY = (minPctY / 100) * bgImage.height;
        const maxY = (maxPctY / 100) * bgImage.height;
        
        const w = maxX - minX;
        const h = maxY - minY;
        
        if (w < 1 || h < 1) return;

        const mapRatio = w / h;
        const screenRatio = this.canvas.width / this.canvas.height;
        
        if (this.rotationMode === 'auto') {
            this.isRotated = (mapRatio > 1 && screenRatio < 1) || (mapRatio < 1 && screenRatio > 1);
        } else if (this.rotationMode === 'horizontal') {
            this.isRotated = mapRatio < 1; 
        } else if (this.rotationMode === 'vertical') {
            this.isRotated = mapRatio > 1; 
        }

        let viewW = this.isRotated ? h : w;
        let viewH = this.isRotated ? w : h;

        const zoomX = (this.canvas.width * 0.75) / viewW;
        const zoomY = (this.canvas.height * 0.75) / viewH;
        this.minScale = Math.min(zoomX, zoomY);
        
        const cx = minX + w/2;
        const cy = minY + h/2;
        
        this.defaultTransform = new DOMMatrix();
        this.defaultTransform.translateSelf(this.canvas.width / 2, this.canvas.height / 2);
        this.defaultTransform.scaleSelf(this.minScale);
        if (this.isRotated) this.defaultTransform.rotateSelf(90);
        
        const isMapLandscape = w > h;
        const finalIsHorizontal = isMapLandscape !== this.isRotated;
        const activeMode = finalIsHorizontal ? 'horizontal' : 'vertical';
        
        const currentFlips = this.flips[activeMode];
        if (currentFlips.h) this.defaultTransform.scaleSelf(-1, 1);
        if (currentFlips.v) this.defaultTransform.scaleSelf(1, -1);
        
        this.defaultTransform.translateSelf(-cx, -cy);

        this.viewTransform = new DOMMatrix(this.defaultTransform);
    }
    
    getActiveMode() {
        if (!this.cachedBounds) return 'horizontal';
        const w = this.cachedBounds.maxPctX - this.cachedBounds.minPctX;
        const h = this.cachedBounds.maxPctY - this.cachedBounds.minPctY;
        const isMapLandscape = w > h;
        return (isMapLandscape !== this.isRotated) ? 'horizontal' : 'vertical';
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
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
            shortcuts, selectedShortcutIdx, previewStateIdx, isTransitioning
        } = state;

        if(!bgImage.complete || isTransitioning) {
            return;
        }

        this.resizeCanvas(state);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.setTransform(this.viewTransform);
        this.ctx.drawImage(bgImage, 0, 0);
        
        const time = Date.now();
        const borderPulse = 6 + Math.sin(time / 200) * 3;

        // Draw Polygons
        rooms.forEach((room, idx) => {
            this.ctx.beginPath();
            room.polygon.forEach((pt, i) => {
                const x = (pt[0] / 100) * bgImage.width;
                const y = (pt[1] / 100) * bgImage.height;
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
                const center = getPolygonCenter(room.polygon);
                const textX = (center[0]/100)*bgImage.width;
                const textY = (center[1]/100)*bgImage.height;
                
                this.ctx.save();
                const pt = new DOMPoint(textX, textY).matrixTransform(this.viewTransform);
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.ctx.translate(pt.x, pt.y);
                
                const currentScale = Math.hypot(this.viewTransform.a, this.viewTransform.b);
                this.ctx.scale(currentScale, currentScale);
                if (this.isRotated) this.ctx.rotate(-Math.PI / 2);

                this.ctx.font = '900 20px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 5;
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
            const x = (sc.position[0] / 100) * bgImage.width;
            const y = (sc.position[1] / 100) * bgImage.height;
            const scaleX = sc.scaleX || sc.scale || 1;
            const scaleY = sc.scaleY || sc.scale || 1;
            
            let shape = sc.config?.shape || sc.shape || 'circle';
            let color = sc.config?.color || sc.color || '#0ea5e9';
            let isTrans = sc.config?.transparent || sc.transparent || false;
            let icon = sc.config?.icon || '💡';
            let image = sc.config?.image || '';

            if (idx === selectedShortcutIdx && previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
                const st = sc.config.states[previewStateIdx];
                if (st.color) color = st.color;
                if (st.icon) icon = st.icon;
                if (st.image) image = st.image;
            }

            const rx = 12 * scaleX;
            const ry = 12 * scaleY;
            const r = Math.max(rx, ry);

            this.ctx.beginPath();
            if (shape === 'rect') {
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
                this.ctx.strokeStyle = 'white';
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
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.ctx.translate(pt.x, pt.y);
                
                const currentScale = Math.hypot(this.viewTransform.a, this.viewTransform.b);
                this.ctx.scale(currentScale, currentScale);
                if (this.isRotated) this.ctx.rotate(-Math.PI / 2);
                
                if (image) {
                    if (!sc._imgCache) sc._imgCache = {};
                    if (!sc._imgCache[image]) {
                        const img = new Image();
                        img.src = image;
                        sc._imgCache[image] = img;
                    }
                    const img = sc._imgCache[image];
                    if (img.complete && img.naturalWidth > 0) {
                        const dim = 20 * Math.min(scaleX, scaleY);
                        this.ctx.drawImage(img, -dim/2, -dim/2, dim, dim);
                    } else {
                        this.ctx.font = `${14 * Math.min(scaleX, scaleY)}px sans-serif`;
                        this.ctx.textBaseline = 'middle';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(icon, 0, 0);
                    }
                } else {
                    this.ctx.font = `${14 * Math.min(scaleX, scaleY)}px sans-serif`;
                    this.ctx.textBaseline = 'middle';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(icon, 0, 0);
                }
                this.ctx.restore();
            }

            if (idx === selectedShortcutIdx) {
                this.ctx.save();
                const pt = new DOMPoint(x, y).matrixTransform(this.viewTransform);
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.ctx.translate(pt.x, pt.y);
                
                const currentScale = Math.hypot(this.viewTransform.a, this.viewTransform.b);
                this.ctx.scale(currentScale, currentScale);
                if (this.isRotated) this.ctx.rotate(-Math.PI / 2);

                this.ctx.font = '10px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'top';
                this.ctx.fillStyle = '#1e293b';
                this.ctx.shadowColor = 'white';
                this.ctx.shadowBlur = 4;
                this.ctx.fillText(sc.name || 'Shortcut', 0, r + 4);
                this.ctx.shadowBlur = 0;
                this.ctx.restore();
            }
        });
        
        this.ctx.restore();
    }
}

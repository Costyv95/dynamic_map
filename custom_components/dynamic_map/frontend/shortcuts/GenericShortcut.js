import { MapShortcut } from './MapShortcut.js';

export class GenericShortcut extends MapShortcut {
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
        this.bgGroup.appendChild(this.shape);
        
        this.iconText = document.createElementNS(this.svgNS, 'text');
        this.iconText.setAttribute('text-anchor', 'middle');
        this.iconText.setAttribute('dominant-baseline', 'central');
        this.iconText.setAttribute('font-size', 16 * Math.min(this.scaleX, this.scaleY));
        this.iconText.style.pointerEvents = 'none';
        this.iconGroup.appendChild(this.iconText);
        
        this.iconForeignObject = document.createElementNS(this.svgNS, 'foreignObject');
        const foSize = 20 * Math.min(this.scaleX, this.scaleY);
        this.iconForeignObject.setAttribute('width', foSize);
        this.iconForeignObject.setAttribute('height', foSize);
        this.iconForeignObject.setAttribute('x', -foSize / 2);
        this.iconForeignObject.setAttribute('y', -foSize / 2);
        this.iconForeignObject.style.pointerEvents = 'none';
        this.iconForeignObject.style.display = 'none';
        this.haIcon = document.createElement('ha-icon');
        this.haIcon.style.cssText = `display:flex; width:100%; height:100%; color: white; --mdc-icon-size: ${foSize}px; align-items:center; justify-content:center;`;
        this.iconForeignObject.appendChild(this.haIcon);
        this.iconGroup.appendChild(this.iconForeignObject);
        
        this.iconImage = document.createElementNS(this.svgNS, 'image');
        const imgSize = 20 * Math.min(this.scaleX, this.scaleY);
        this.iconImage.setAttribute('width', imgSize);
        this.iconImage.setAttribute('height', imgSize);
        this.iconImage.setAttribute('x', -imgSize / 2);
        this.iconImage.setAttribute('y', -imgSize / 2);
        this.iconImage.style.pointerEvents = 'none';
        this.iconImage.style.display = 'block';
        this.iconImage.style.opacity = '0';

        // Native SVG <image> loading & error event listeners
        this.iconImage.addEventListener('load', () => {
            const currentHref = this.iconImage.getAttribute('href');
            if (currentHref) {
                if (!this._imgStatusCache) this._imgStatusCache = {};
                this._imgStatusCache[currentHref] = { state: 'loaded', lastFailureTime: 0 };
                
                if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                    window.dynamicMapDebug.log(`Native image (via SVG element) LOADED successfully: "${currentHref}"`, { entity: this.sc.entity_id });
                }
                
                if (this._lastImage === currentHref) {
                    this.iconText.textContent = '';
                    this.iconForeignObject.style.display = 'none';
                    this.iconImage.style.opacity = '1';
                }
            }
        });
        
        this.iconImage.addEventListener('error', () => {
            const currentHref = this.iconImage.getAttribute('href');
            if (currentHref) {
                if (!this._imgStatusCache) this._imgStatusCache = {};
                this._imgStatusCache[currentHref] = { state: 'error', lastFailureTime: Date.now() };
                
                if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                    window.dynamicMapDebug.log(`Native image (via SVG element) FAILED for: "${currentHref}"`, { entity: this.sc.entity_id });
                }
                
                if (this._lastImage === currentHref) {
                    this.iconImage.style.opacity = '0';
                    this.showFallbackIcon();
                }
            }
        });

        this.iconGroup.appendChild(this.iconImage);
        
        // Let MapShortcut append the state badge to iconGroup
        this.iconGroup.appendChild(this.stateBadge);
        
        return this.group;
    }
    
    updateState(hass) {
        super.updateState(hass);
        
        let activeScaleX = this.scaleX;
        let activeScaleY = this.scaleY;
        
        const isAutoRotate = this.getIsAutoRotateActive();
        if (isAutoRotate && this.mapContext.isRotated) {
            activeScaleX = this.scaleY;
            activeScaleY = this.scaleX;
        }

        const rx = 12 * activeScaleX;
        const ry = 12 * activeScaleY;

        if (this.shape) {
            const shapeType = this.config.shape === 'rect' ? 'rect' : 'circle';
            if (shapeType === 'rect') {
                this.shape.setAttribute('x', -rx);
                this.shape.setAttribute('y', -ry);
                this.shape.setAttribute('width', rx * 2);
                this.shape.setAttribute('height', ry * 2);
            } else {
                this.shape.setAttribute('r', rx);
            }
        }
        
        const imgSize = 20 * Math.min(activeScaleX, activeScaleY);
        if (this.iconImage) {
            this.iconImage.setAttribute('width', imgSize);
            this.iconImage.setAttribute('height', imgSize);
            this.iconImage.setAttribute('x', -imgSize / 2);
            this.iconImage.setAttribute('y', -imgSize / 2);
        }
        if (this.iconForeignObject) {
            const foSize = 20 * Math.min(activeScaleX, activeScaleY);
            this.iconForeignObject.setAttribute('width', foSize);
            this.iconForeignObject.setAttribute('height', foSize);
            this.iconForeignObject.setAttribute('x', -foSize / 2);
            this.iconForeignObject.setAttribute('y', -foSize / 2);
            if (this.haIcon) {
                this.haIcon.style.cssText = `display:flex; width:100%; height:100%; color: white; --mdc-icon-size: ${foSize}px; align-items:center; justify-content:center;`;
            }
        }
        if (this.iconText) {
            this.iconText.setAttribute('font-size', 16 * Math.min(activeScaleX, activeScaleY));
        }
        
        let color = this.config.color || this.defaultColor || '#0ea5e9';
        let icon = this.config.icon || this.defaultIcon || '';
        let image = this.config.image || '';
        
        if (this.activeState) {
            if (this.activeState.color) color = this.activeState.color;
            if (this.activeState.image) {
                image = this.activeState.image;
                icon = this.activeState.icon || '';
            } else if (this.activeState.icon) {
                icon = this.activeState.icon;
                image = '';
            }
        }
        
        const finalImage = image || (icon && (icon.startsWith('http') || icon.startsWith('/') || icon.endsWith('.png') || icon.endsWith('.svg') || icon.endsWith('.jpg') || icon.endsWith('.webp')) ? icon : '');
        
        // Initialize global telemetry debugger
        if (typeof window !== 'undefined') {
            if (!window.dynamicMapDebug) {
                window.dynamicMapDebug = {
                    logs: [],
                    shortcuts: {},
                    log: function(msg, obj) {
                        const entry = {
                            timestamp: new Date().toISOString(),
                            message: msg,
                            data: obj ? JSON.parse(JSON.stringify(obj)) : null
                        };
                        this.logs.push(entry);
                        if (this.logs.length > 500) this.logs.shift();
                        console.log(`[DynamicMapDebug] ${msg}`, obj || '');
                    }
                };
            }
            window.dynamicMapDebug.shortcuts[this.sc.id || this.sc.entity_id || 'unknown'] = {
                entity_id: this.sc.entity_id,
                activeState: this.activeState ? {
                    id: this.activeState.id,
                    name: this.activeState.name,
                    value: this.activeState.value,
                    color: this.activeState.color,
                    image: this.activeState.image,
                    icon: this.activeState.icon
                } : null,
                color,
                image,
                icon,
                finalImage,
                preloaderState: null
            };
            window.dynamicMapDebug.log(`updateState evaluating for entity: ${this.sc.entity_id}`, {
                state: this.sc.entity_id && hass.states[this.sc.entity_id] ? hass.states[this.sc.entity_id].state : 'unknown',
                activeStateId: this.activeState ? this.activeState.id : 'none',
                color,
                finalImage
            });
        }

        let changed = false;
        if (this._lastColor !== color) { this._lastColor = color; changed = true; }
        if (this._lastIcon !== icon) { this._lastIcon = icon; changed = true; }
        if (this._lastImage !== finalImage) { this._lastImage = finalImage; changed = true; }
        if (this._lastTransparent !== !!this.config.transparent) { this._lastTransparent = !!this.config.transparent; changed = true; }
        
        if (!changed && this._initialized) {
            const status = this._imgStatusCache && this._imgStatusCache[finalImage];
            const hasFailedImageWithCooldown = status && status.state === 'error' && (Date.now() - (status.lastFailureTime || 0) > 15000);
            if (!hasFailedImageWithCooldown) {
                return false;
            }
        }
        this._initialized = true;

        if (!this.config.transparent) {
            this.shape.setAttribute('fill', color);
            this.shape.setAttribute('stroke', 'white');
            this.iconText.setAttribute('fill', 'white');
            this.haIcon.style.color = 'white';
        } else {
            this.shape.setAttribute('fill', 'rgba(0,0,0,0)');
            this.shape.setAttribute('stroke', 'rgba(0,0,0,0)');
            this.iconText.setAttribute('fill', color);
            this.haIcon.style.color = color;
        }
        
        const isUrlFn = (str) => str && (str.startsWith('http') || str.startsWith('/') || str.endsWith('.png') || str.endsWith('.svg') || str.endsWith('.jpg') || str.endsWith('.webp'));
        let fallbackIcon = '💡';
        if (this.activeState && this.activeState.icon && !isUrlFn(this.activeState.icon)) {
            fallbackIcon = this.activeState.icon;
        } else if (this.config.icon && !isUrlFn(this.config.icon)) {
            fallbackIcon = this.config.icon;
        } else if (this.defaultIcon && !isUrlFn(this.defaultIcon)) {
            fallbackIcon = this.defaultIcon;
        }
        this._currentFallbackIcon = fallbackIcon;
        
        if (finalImage) {
            if (!this._imgStatusCache) this._imgStatusCache = {};
            
            let status = this._imgStatusCache[finalImage];
            if (status && status.state === 'error' && (Date.now() - (status.lastFailureTime || 0) > 15000)) {
                if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                    window.dynamicMapDebug.log(`Image retry cooldown elapsed for: "${finalImage}". Retrying...`, { entity: this.sc.entity_id });
                }
                delete this._imgStatusCache[finalImage];
                status = null;
            }

            // Sync shortcut status in debug map
            if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                window.dynamicMapDebug.shortcuts[this.sc.id || this.sc.entity_id || 'unknown'].preloaderState = {
                    loaded: status ? status.state === 'loaded' : false,
                    error: status ? status.state === 'error' : false
                };
            }

            if (status && status.state === 'loaded') {
                if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                    window.dynamicMapDebug.log(`Image already loaded for: "${finalImage}". Drawing immediately.`, { entity: this.sc.entity_id });
                }
                this.iconText.textContent = '';
                this.iconForeignObject.style.display = 'none';
                if (this.iconImage.getAttribute('href') !== finalImage) {
                    this.iconImage.setAttribute('href', finalImage);
                    this.iconImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', finalImage);
                }
                this.iconImage.style.opacity = '1';
            } else if (status && status.state === 'error') {
                if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                    window.dynamicMapDebug.log(`Image previously failed for: "${finalImage}". Drawing fallback.`, { entity: this.sc.entity_id });
                }
                this.iconImage.removeAttribute('href');
                this.iconImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href');
                this.iconImage.style.opacity = '0';
                this.showFallbackIcon();
            } else {
                if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                    window.dynamicMapDebug.log(`Setting image source & loading natively: "${finalImage}"`, { entity: this.sc.entity_id });
                }
                
                if (!status) {
                    this._imgStatusCache[finalImage] = { state: 'loading', lastFailureTime: 0 };
                }
                
                this.iconImage.removeAttribute('href');
                this.iconImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href');
                this.iconImage.style.opacity = '0';
                this.showFallbackIcon();
                
                // Directly set the source on the SVG <image> tag to let the browser natively load it
                this.iconImage.setAttribute('href', finalImage);
                this.iconImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', finalImage);
            }
        } else {
            if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                window.dynamicMapDebug.log(`No image to load for "${this.sc.entity_id}". Showing fallback icon: "${fallbackIcon}"`, { entity: this.sc.entity_id });
            }
            this.iconImage.removeAttribute('href');
            this.iconImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href');
            this.iconImage.style.opacity = '0';
            this.showFallbackIcon();
        }
        
        return true;
    }

    getIsAutoRotateActive() {
        if (this.activeState && this.activeState.autoRotate !== undefined) {
            return !!this.activeState.autoRotate;
        }
        return !!(this.config && this.config.autoRotate);
    }

    showFallbackIcon() {
        const icon = this._currentFallbackIcon || '💡';
        if (icon.startsWith('mdi:') || icon.includes(':')) {
            this.iconText.textContent = '';
            this.haIcon.setAttribute('icon', icon);
            this.iconForeignObject.style.display = 'block';
        } else {
            this.iconForeignObject.style.display = 'none';
            this.iconText.textContent = icon;
        }
    }
}


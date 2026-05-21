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
        this.iconImage.style.display = 'none';
        this.iconGroup.appendChild(this.iconImage);
        
        // Let MapShortcut append the state badge to iconGroup
        this.iconGroup.appendChild(this.stateBadge);
        
        // We do not call super.render() anymore because MapShortcut's render just appends stateBadge to group, 
        // which we already did to iconGroup.
        return this.group;
    }
    
    updateState(hass) {
        super.updateState(hass);
        
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
        
        if (!changed && this._initialized) return false;
        this._initialized = true;

        if (!this.config.transparent) {
            this.shape.setAttribute('fill', color);
        } else {
            this.shape.setAttribute('fill', 'rgba(0,0,0,0)');
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
            if (!this._imgPreloaders) this._imgPreloaders = {};
            
            let preloader = this._imgPreloaders[finalImage];
            if (!preloader) {
                if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                    window.dynamicMapDebug.log(`Creating preloader for: "${finalImage}"`, { entity: this.sc.entity_id });
                }
                const img = new Image();
                preloader = {
                    loaded: false,
                    error: false,
                    img: img, // Pin Image object to prevent Garbage Collection!
                    promise: new Promise((resolve) => {
                        img.onload = () => {
                            const dims = { w: img.naturalWidth, h: img.naturalHeight };
                            if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                                window.dynamicMapDebug.log(`Preloader LOADED successfully: "${finalImage}"`, {
                                    entity: this.sc.entity_id,
                                    dimensions: dims
                                });
                            }
                            preloader.loaded = true;
                            resolve(true);
                        };
                        img.onerror = (err) => {
                            if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                                window.dynamicMapDebug.log(`Preloader FAILED for: "${finalImage}"`, {
                                    entity: this.sc.entity_id,
                                    error: err ? err.message || String(err) : 'Unknown error'
                                });
                            }
                            preloader.error = true;
                            resolve(false);
                        };
                        img.src = finalImage;
                    })
                };
                this._imgPreloaders[finalImage] = preloader;
            }

            // Sync shortcut status in debug map
            if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                window.dynamicMapDebug.shortcuts[this.sc.id || this.sc.entity_id || 'unknown'].preloaderState = {
                    loaded: preloader.loaded,
                    error: preloader.error
                };
            }

            if (preloader.loaded) {
                if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                    window.dynamicMapDebug.log(`Preloader already loaded for: "${finalImage}". Drawing immediately.`, { entity: this.sc.entity_id });
                }
                this.iconText.textContent = '';
                this.iconForeignObject.style.display = 'none';
                if (this.iconImage.getAttribute('href') !== finalImage) {
                    this.iconImage.setAttribute('href', finalImage);
                    this.iconImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', finalImage);
                }
                this.iconImage.style.display = 'block';
            } else if (preloader.error) {
                if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                    window.dynamicMapDebug.log(`Preloader previously failed for: "${finalImage}". Drawing fallback.`, { entity: this.sc.entity_id });
                }
                this.iconImage.removeAttribute('href');
                this.iconImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href');
                this.iconImage.style.display = 'none';
                this.showFallbackIcon();
            } else {
                if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                    window.dynamicMapDebug.log(`Preloader is currently loading for: "${finalImage}". Drawing fallback placeholder.`, { entity: this.sc.entity_id });
                }
                this.iconImage.removeAttribute('href');
                this.iconImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href');
                this.iconImage.style.display = 'none';
                this.showFallbackIcon();
                
                preloader.promise.then((success) => {
                    if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                        window.dynamicMapDebug.log(`Preloader promise resolved for: "${finalImage}" (success: ${success})`, { entity: this.sc.entity_id });
                        if (window.dynamicMapDebug.shortcuts[this.sc.id || this.sc.entity_id || 'unknown']) {
                            window.dynamicMapDebug.shortcuts[this.sc.id || this.sc.entity_id || 'unknown'].preloaderState = {
                                loaded: preloader.loaded,
                                error: preloader.error
                            };
                        }
                    }
                    if (this._lastImage === finalImage) {
                        if (success) {
                            if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                                window.dynamicMapDebug.log(`Applying loaded image to SVG for: "${finalImage}"`, { entity: this.sc.entity_id });
                            }
                            this.iconText.textContent = '';
                            this.iconForeignObject.style.display = 'none';
                            this.iconImage.setAttribute('href', finalImage);
                            this.iconImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', finalImage);
                            this.iconImage.style.display = 'block';
                        } else {
                            if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                                window.dynamicMapDebug.log(`Applying fallback to SVG due to preloader failure for: "${finalImage}"`, { entity: this.sc.entity_id });
                            }
                            this.iconImage.removeAttribute('href');
                            this.iconImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href');
                            this.iconImage.style.display = 'none';
                            this.showFallbackIcon();
                        }
                    } else {
                        if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                            window.dynamicMapDebug.log(`Active image has changed from "${finalImage}" to "${this._lastImage}". Skipping preloader resolve.`, { entity: this.sc.entity_id });
                        }
                    }
                });
            }
        } else {
            if (typeof window !== 'undefined' && window.dynamicMapDebug) {
                window.dynamicMapDebug.log(`No image to load for "${this.sc.entity_id}". Showing fallback icon: "${fallbackIcon}"`, { entity: this.sc.entity_id });
            }
            this.iconImage.removeAttribute('href');
            this.iconImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href');
            this.iconImage.style.display = 'none';
            this.showFallbackIcon();
        }
        
        return true;
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

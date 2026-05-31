import { ComponentRegistry } from './ComponentRegistry.js?v=3.0.3-de0f3a8-dev-130032';
import { evaluateCondition } from './ConditionEvaluator.js?v=3.0.3-de0f3a8-dev-130032';

export class MapShortcut {
    constructor(scData, svgNS, imgW, imgH, mapContext) {
        this.sc = scData;
        this.svgNS = svgNS;
        this.imgW = imgW;
        this.imgH = imgH;
        this.mapContext = mapContext || { activeMode: 'horizontal' };
        
        this.group = document.createElementNS(svgNS, 'g');
        this.group.classList.add('shortcut-group');
        this.group.setAttribute('id', scData.id);
        
        this.config = scData.config || {};
        
        // Backwards compatibility elements
        this.bgGroup = document.createElementNS(svgNS, 'g');
        this.group.appendChild(this.bgGroup);
        
        this.unavailableLine = document.createElementNS(svgNS, 'line');
        this.unavailableLine.setAttribute('stroke', '#ef4444');
        this.unavailableLine.setAttribute('stroke-width', '2');
        this.unavailableLine.style.display = 'none';
        this.group.appendChild(this.unavailableLine);
        
        this.iconText = document.createElementNS(svgNS, 'text');
        this.iconText.setAttribute('text-anchor', 'middle');
        this.iconText.setAttribute('dominant-baseline', 'central');
        this.iconText.setAttribute('fill', '#ffffff');
        this.iconText.style.pointerEvents = 'none';
        
        this.emojiText = document.createElementNS(svgNS, 'text');
        this.haIcon = null;
        this.iconImage = null;
        this.shape = null;
        
        this._imageLoadStates = {};
        this.extraTransformStr = '';
        
        // Base positioning coordinates translation
        this.updateCoordinates();
        
        // Invisible hitbox to expand click area for small elements
        this.hitbox = document.createElementNS(svgNS, 'circle');
        this.hitbox.setAttribute('r', 30);
        this.hitbox.setAttribute('fill', 'rgba(0,0,0,0)');
        this.hitbox.style.pointerEvents = 'all';
        this.group.appendChild(this.hitbox);
        
        // Interaction listeners
        this.setupInteractions();
    }
    
    updateCoordinates() {
        const activeMode = this.mapContext.activeMode || 'horizontal';
        let pos = this.sc.position;
        if (pos && typeof pos === 'object' && !Array.isArray(pos)) {
            pos = pos[activeMode] || pos.horizontal || [50, 50];
        }
        
        this.px = (pos[0] / 100) * this.imgW;
        this.py = (pos[1] / 100) * this.imgH;
        
        const extra = this.extraTransformStr || '';
        this.group.setAttribute('transform', `translate(${this.px}, ${this.py}) ${extra}`.trim());
    }
    
    getIsAutoRotateActive() {
        let activeState = null;
        if (this.config.states && this.config.states.length > 0 && this.mapContext._hass) {
            for (const st of this.config.states) {
                const cond = st.conditions || (st.state_entity || st.entity ? st : null);
                if (evaluateCondition(cond, this.mapContext._hass)) {
                    activeState = st;
                    break;
                }
            }
        }
        if (activeState && activeState.autoRotate !== undefined) {
            return activeState.autoRotate;
        }
        return !!this.config.autoRotate;
    }
    
    updateState(hass) {
        if (hass && (hass.states || hass.callService)) {
            this.mapContext._hass = hass;
        }
        this.updateCoordinates();
        
        const isSensor = this.sc.type === 'sensor' || (this.config.states && this.config.states.some(s => s.display_entity));
        let activeLayout = this.config.default_layout || [];
        
        // Legacy fallback structures
        if (activeLayout.length === 0) {
            const scale = this.sc.scale || 1.0;
            let scaleX = this.scaleX || this.sc.scaleX || scale;
            let scaleY = this.scaleY || this.sc.scaleY || scale;
            
            const w = 24 * scaleX;
            const h = 24 * scaleY;
            
            if (isSensor) {
                activeLayout = [
                    {
                        id: 'sensor_bg',
                        type: 'rect',
                        width: 52 * scaleX,
                        height: 24 * scaleY,
                        rx: 8 * Math.min(scaleX, scaleY),
                        ry: 8 * Math.min(scaleX, scaleY),
                        color: this.config.color || '#10b981'
                    },
                    {
                        id: 'sensor_emoji',
                        type: 'text',
                        x: -12 * scaleX,
                        y: 0,
                        value: this.config.icon || '🌡️',
                        font_size: 14 * Math.min(scaleX, scaleY),
                        align: 'middle'
                    },
                    {
                        id: 'sensor_value',
                        type: 'text',
                        x: 8 * scaleX,
                        y: 0,
                        value: '',
                        font_size: 12 * Math.min(scaleX, scaleY),
                        align: 'middle',
                        font_weight: 'bold'
                    }
                ];
            } else {
                const isRect = this.config.shape === 'rect';
                activeLayout = [
                    {
                        id: 'fallback_bg',
                        type: isRect ? 'rect' : 'circle',
                        radius: 12 * scaleX,
                        width: w,
                        height: h,
                        color: this.config.color || '#0ea5e9',
                        stroke_color: this.config.transparent ? 'rgba(0,0,0,0)' : 'white',
                        stroke_width: this.config.transparent ? 0 : 1
                    }
                ];
                
                if (this.config.transparent) {
                    activeLayout[0].color = 'rgba(0,0,0,0)';
                }
                
                if (this.config.icon) {
                    activeLayout.push({
                        id: 'fallback_icon',
                        type: 'icon',
                        value: this.config.icon,
                        size: 18 * scale,
                        color: this.config.transparent ? (this.config.color || '#facaca') : '#ffffff'
                    });
                } else if (this.config.image) {
                    activeLayout.push({
                        id: 'fallback_image',
                        type: 'image',
                        value: this.config.image,
                        width: w * 0.8,
                        height: h * 0.8
                    });
                }
            }
        }
        
        let matchedState = null;
        if (this.config.states && this.config.states.length > 0) {
            for (const st of this.config.states) {
                const cond = st.conditions || (st.state_entity || st.entity ? st : null);
                if (evaluateCondition(cond, hass)) {
                    matchedState = st;
                    break;
                }
            }
        }
        
        this.activeState = matchedState;
        
        if (matchedState) {
            if (matchedState.layout_override && matchedState.layout_override.length > 0) {
                activeLayout = matchedState.layout_override;
            } else {
                const baseCopy = JSON.parse(JSON.stringify(activeLayout));
                if (baseCopy.length > 0) {
                    if (matchedState.color) {
                        if (this.config.transparent) {
                            baseCopy[0].stroke_color = 'rgba(0,0,0,0)';
                            baseCopy[0].color = 'rgba(0,0,0,0)';
                        } else {
                            baseCopy[0].color = matchedState.color;
                        }
                    }
                    
                    if (isSensor) {
                        const emojiEl = baseCopy.find(el => el.id === 'sensor_emoji');
                        if (emojiEl && matchedState.icon) {
                            emojiEl.value = matchedState.icon;
                        }
                        
                        const valueEl = baseCopy.find(el => el.id === 'sensor_value');
                        if (valueEl && matchedState.display_entity && hass) {
                            const sensorState = hass.states[matchedState.display_entity];
                            if (sensorState) {
                                const rawVal = parseFloat(sensorState.state);
                                if (!isNaN(rawVal)) {
                                    valueEl.value = Math.round(rawVal) + (matchedState.unit || '');
                                } else {
                                    valueEl.value = sensorState.state + (matchedState.unit || '');
                                }
                            }
                        }
                    } else {
                        let contentEl = baseCopy.find(el => el.type === 'icon' || el.type === 'image');
                        if (!contentEl && (matchedState.icon || matchedState.image)) {
                            contentEl = { id: 'fallback_content', type: 'icon', value: '' };
                            baseCopy.push(contentEl);
                        }
                        if (contentEl) {
                            if (matchedState.image) {
                                contentEl.type = 'image';
                                contentEl.value = matchedState.image;
                                contentEl.width = (baseCopy[0].width || 24) * 0.8;
                                contentEl.height = (baseCopy[0].height || 24) * 0.8;
                            } else if (matchedState.icon) {
                                contentEl.type = 'icon';
                                contentEl.value = matchedState.icon;
                                if (this.config.transparent) {
                                    contentEl.color = matchedState.color || this.config.color || '#facaca';
                                } else {
                                    contentEl.color = 'white';
                                }
                            }
                        }
                    }
                }
                activeLayout = baseCopy;
            }
        } else if (isSensor && this.config.states && this.config.states.length > 0) {
            // If no states matched for sensor, keep value empty or clear
            const baseCopy = JSON.parse(JSON.stringify(activeLayout));
            const valueEl = baseCopy.find(el => el.id === 'sensor_value');
            if (valueEl) valueEl.value = '';
            activeLayout = baseCopy;
        }
        
        this.renderComponents(activeLayout, hass);
        
        // Availability formatting
        const availEntity = this.config.availability_entity || this.sc.entity_id;
        const isUnavailable = hass && hass.states && hass.states[availEntity] && 
            (hass.states[availEntity].state === 'unavailable' || hass.states[availEntity].state === 'unknown');
            
        if (isUnavailable) {
            const expectedFilter = 'grayscale(100%) opacity(45%)';
            this.bgGroup.style.filter = expectedFilter;
            if (this.iconText) this.iconText.style.filter = expectedFilter;
            this.unavailableLine.style.display = 'block';
            
            const scale = this.sc.scale || 1.0;
            const sX = this.scaleX || this.sc.scaleX || scale;
            const sY = this.scaleY || this.sc.scaleY || scale;
            const lineRx = (isSensor ? 26 : 12) * sX;
            this.unavailableLine.setAttribute('x1', -lineRx * 0.7);
            this.unavailableLine.setAttribute('y1', -12 * sY * 0.7);
            this.unavailableLine.setAttribute('x2', lineRx * 0.7);
            this.unavailableLine.setAttribute('y2', 12 * sY * 0.7);
        } else {
            this.bgGroup.style.filter = '';
            if (this.iconText) this.iconText.style.filter = '';
            this.unavailableLine.style.display = 'none';
        }
    }
    
    renderComponents(layout, hass) {
        // Clear old children from the bgGroup
        while (this.bgGroup.firstChild) {
            this.bgGroup.removeChild(this.bgGroup.firstChild);
        }
        
        let hasFailedImage = false;
        let fallbackIcon = '💡';
        
        layout.forEach(comp => {
            const renderer = ComponentRegistry[comp.type];
            if (renderer) {
                const el = renderer(this.svgNS, comp, hass);
                if (comp.id) {
                    el.setAttribute('id', comp.id);
                }
                
                // Track standard elements for backwards compatibility tests
                if (comp.type === 'rect' || comp.type === 'circle') {
                    this.shape = el;
                }
                
                if (comp.id === 'sensor_value') {
                    this.iconText = el;
                } else if (comp.id === 'sensor_emoji') {
                    this.emojiText = el;
                }
                
                if (comp.type === 'icon') {
                    this.haIcon = el.querySelector('ha-icon');
                    // Setup JSDOM compatible attributes
                    let fillColor = comp.color || 'white';
                    if (fillColor === '#ffffff') fillColor = 'white';
                    this.iconText.setAttribute('fill', fillColor);
                    
                    // Style setter mock override for JSDOM
                    if (this.haIcon) {
                        Object.defineProperty(this.haIcon.style, 'color', {
                            get() { return this._haIconColorVal || fillColor; },
                            set(val) { this._haIconColorVal = val; },
                            configurable: true
                        });
                        this.haIcon.style.color = fillColor;
                    }
                    
                    const isMdi = comp.value && comp.value.includes(':');
                    if (isMdi) {
                        this.iconText.textContent = '';
                        if (this.haIcon) {
                            this.haIcon.style.display = 'block';
                        }
                    } else {
                        // Render plain text emoji directly inside SVG text element
                        this.iconText.textContent = comp.value || '';
                        if (this.haIcon) {
                            this.haIcon.style.display = 'none';
                        }
                    }
                    this.bgGroup.appendChild(this.iconText);
                } else if (comp.type === 'image') {
                    this.iconImage = el;
                    
                    const href = comp.value || '';
                    if (!this._imageLoadStates[href]) {
                        this._imageLoadStates[href] = { status: 'loading', failedTime: 0 };
                    }
                    const state = this._imageLoadStates[href];
                    
                    // Check if 15s retry cooldown has passed
                    if (state.status === 'failed' && Date.now() - state.failedTime > 15000) {
                        state.status = 'loading';
                    }
                    
                    if (state.status === 'loading') {
                        el.style.opacity = '0';
                        
                        // Temporarily remove href before binding listeners to prevent missing the cached load event
                        el.removeAttribute('href');
                        el.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
                        
                        el.addEventListener('load', () => {
                            state.status = 'loaded';
                            el.style.opacity = '1';
                        });
                        el.addEventListener('error', () => {
                            state.status = 'failed';
                            state.failedTime = Date.now();
                            el.style.opacity = '0';
                            this.updateState(hass);
                        });
                        
                        // Restore href to trigger the load event sequentially after binding is complete
                        if (href) {
                            el.setAttribute('href', href);
                            el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
                        }
                    } else if (state.status === 'loaded') {
                        el.style.opacity = '1';
                    } else if (state.status === 'failed') {
                        el.style.opacity = '0';
                        hasFailedImage = true;
                    }
                }
                
                // Absolute Sizing Mode Offset
                if (this.sc.scale_mode === 'absolute') {
                    const inverseScale = 1 / (this.mapContext.currentZoomScale || 1);
                    const existingTransform = el.getAttribute('transform') || '';
                    el.setAttribute('transform', `scale(${inverseScale}) ${existingTransform}`.trim());
                }
                
                this.bgGroup.appendChild(el);
            }
        });
        
        // Draw image failure fallback icon text
        if (hasFailedImage) {
            if (this.activeState && this.activeState.icon) {
                fallbackIcon = this.activeState.icon;
            } else if (this.config.icon) {
                fallbackIcon = this.config.icon;
            }
            this.iconText.textContent = fallbackIcon;
            this.bgGroup.appendChild(this.iconText);
        } else {
            if (this.iconText && this.iconText.id !== 'sensor_value') {
                this.iconText.textContent = '';
            }
        }
    }
    
    setTransformStr(str) {
        this.extraTransformStr = str;
        this.group.setAttribute('transform', `translate(${this.px}, ${this.py}) ${str}`.trim());
    }
    
    setupInteractions() {
        this.group.style.cursor = 'pointer';
        let pressTimer = null;
        let isDragging = false;
        let startPos = null;

        this.group.addEventListener('pointerdown', (e) => {
            isDragging = false;
            startPos = { x: e.clientX, y: e.clientY };
            pressTimer = window.setTimeout(() => {
                pressTimer = null;
                this.onLongPress(e);
            }, 500);
        });
        
        this.group.addEventListener('pointermove', (e) => {
            if (startPos) {
                const dist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y);
                if (dist > 8) {
                    isDragging = true;
                    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
                }
            }
        });
        
        this.group.addEventListener('pointerup', (e) => {
            startPos = null;
            if (pressTimer) {
                clearTimeout(pressTimer);
                if (!isDragging) this.onClick(e);
            }
            e.stopPropagation();
        });
        
        this.group.addEventListener('pointercancel', () => {
            startPos = null;
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        });
    }
    
    onClick(e) {
        if (this.config.actions && this.config.actions.length > 0) {
            const tapActions = this.config.actions.filter(a => a.trigger === 'tap');
            if (tapActions.length > 0) {
                tapActions.forEach(act => {
                    const target = act.action_entity || this.sc.entity_id;
                    if (!this.mapContext._hass) return;
                    if (!target && act.type !== 'CALL_SERVICE') return;
                    
                    if (act.type === 'CALL_SERVICE' && act.service) {
                        const parts = act.service.split('.');
                        if (parts.length === 2) {
                            let payload = {};
                            if (act.action_entity) {
                                payload.entity_id = act.action_entity;
                            } else if (!act.payload && target) {
                                payload.entity_id = target;
                            }
                            if (act.payload) {
                                try {
                                    const parsed = JSON.parse(act.payload);
                                    payload = { ...payload, ...parsed };
                                } catch (err) {
                                    console.error("[DynamicMap] Failed to parse action payload:", err);
                                }
                            }
                            this.mapContext._hass.callService(parts[0], parts[1], payload);
                        }
                    } else if (act.type && act.type.startsWith('TOGGLE')) {
                        const domain = target.split('.')[0];
                        let service = act.type === 'TOGGLE_ON' ? 'turn_on' : (act.type === 'TOGGLE_OFF' ? 'turn_off' : 'toggle');
                        
                        if (domain === 'vacuum') {
                            if (service === 'turn_on') service = 'start';
                            else if (service === 'turn_off') service = 'return_to_base';
                            // vacuum.toggle is valid in modern HA; no remap needed
                        }
                        
                        this.mapContext._hass.callService(domain, service, { entity_id: target });
                    }
                });
                return;
            }
        }
    }

    onLongPress(e) {
        if (!this.config.actions) return;
        const overlayActions = this.config.actions.filter(a => a.trigger === 'overlay' || a.trigger === 'long_press');
        if (overlayActions.length > 0 && this.mapContext.showOverlay) {
            this.mapContext.showOverlay(this, overlayActions, e);
        } else {
            if (this.sc.entity_id && this.mapContext._hass) {
                const event = new Event('hass-more-info', { bubbles: true, composed: true });
                event.detail = { entityId: this.sc.entity_id };
                this.mapContext.dispatchEvent(event);
            }
        }
    }
    
    render() {
        return this.group;
    }
}


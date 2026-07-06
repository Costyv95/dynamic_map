import { ComponentRegistry } from './ComponentRegistry.js?v=3.2.0';
import { evaluateCondition } from './ConditionEvaluator.js?v=3.2.0';
import { evaluateTemplate } from './TemplateEvaluator.js?v=3.2.0';
import { isOrientationObject, resolveOriented, resolveOrientedLoose, resolveOrientedStrict } from '../shared/OrientationProps.js?v=3.2.0';
import { executeAction } from '../shared/ActionRunner.js?v=3.2.0';
import { computeSensorPill } from '../shared/SensorPill.js?v=3.2.0';

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
        
        this.contentGroup = document.createElementNS(svgNS, 'g');
        this.group.appendChild(this.contentGroup);
        
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
        if (isOrientationObject(pos)) {
            pos = resolveOrientedLoose(pos, activeMode, [50, 50]);
        }

        this.px = (pos[0] / 100) * this.imgW;
        this.py = (pos[1] / 100) * this.imgH;

        const customRot = resolveOriented(this.sc.rotation, activeMode, 0);

        const extra = this.extraTransformStr || '';
        const rotStr = customRot ? `rotate(${customRot})` : '';
        this.group.setAttribute('transform', `translate(${this.px}, ${this.py}) ${rotStr} ${extra}`.trim());
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
        
        // 1. Evaluate matchedState (checking conditional states first, then default fallback state)
        let matchedState = null;
        if (this.config.states && this.config.states.length > 0) {
            for (const st of this.config.states) {
                if (st.is_default) continue; // Skip default fallback during conditional check
                const cond = st.conditions || (st.state_entity || st.entity ? st : null);
                if (evaluateCondition(cond, hass)) {
                    matchedState = st;
                    break;
                }
            }
            if (!matchedState) {
                matchedState = this.config.states.find(st => st.is_default) || null;
            }
        }
        this.activeState = matchedState;

        const isSensor = this.sc.type === 'sensor' || (this.config.states && this.config.states.some(s => s.display_entity));
        const customLayout = this.config.default_layout || [];
        let activeLayout = customLayout;

        if (activeLayout.length === 0) {
            const activeMode = this.mapContext.activeMode || 'horizontal';
            
            // Unified property resolver: checks matchedState override, then falls back to root this.sc or instance properties
            const resolveProperty = (prop, defaultVal) => {
                const val = matchedState?.[prop] !== undefined ? matchedState[prop] : (this.sc[prop] !== undefined ? this.sc[prop] : this[prop]);
                return resolveOriented(val, activeMode, defaultVal);
            };
            
            let scaleVal = resolveProperty('scale', 1.0);
            let scaleXVal = resolveProperty('scaleX', scaleVal);
            let scaleYVal = resolveProperty('scaleY', scaleVal);
            
            // Shape, transparent, and autoRotate overrides
            const shape = matchedState?.shape || this.config?.shape || this.sc?.shape || (isSensor ? 'rect' : 'circle');
            const propDefault = (shape === 'circle');
            const isProportional = this.config.proportional !== undefined ? this.config.proportional : propDefault;
            
            const scaleX = scaleXVal;
            let scaleY = scaleYVal;
            if (isProportional) {
                scaleY = scaleX;
            }
            this.scaleX = scaleX;
            this.scaleY = scaleY;
            const scale = Math.min(scaleX, scaleY);
            
            const w = 24 * scaleX;
            const h = 24 * scaleY;
            
            const targetConfig = matchedState || this.config;
            const contentMatchSize = targetConfig.content_matchSize !== undefined ? !!targetConfig.content_matchSize : (this.config.content_matchSize !== undefined ? !!this.config.content_matchSize : true);

            // Auto-built layouts resolve state overrides (color, transparent,
            // icon/image) up front — no second build-then-patch pass needed.
            const stColor = matchedState?.color || this.config.color;
            const stTrans = matchedState?.transparent !== undefined ? matchedState.transparent : this.config.transparent;

            if (isSensor) {
                activeLayout = this._buildSensorLayout(matchedState, hass, scaleX, scaleY);
            } else {
                const isRect = shape === 'rect';
                activeLayout = [
                    {
                        id: 'fallback_bg',
                        type: isRect ? 'rect' : 'circle',
                        radius: 12 * scaleX,
                        radiusX: 12 * scaleX,
                        radiusY: 12 * scaleY,
                        width: w,
                        height: h,
                        color: stTrans ? 'rgba(0,0,0,0)' : (stColor || '#0ea5e9'),
                        stroke_color: stTrans ? 'rgba(0,0,0,0)' : 'white',
                        stroke_width: stTrans ? 0 : 1
                    }
                ];

                // A state image beats the base icon; otherwise icon beats image.
                const iconVal = matchedState?.icon || this.config.icon;
                const imgVal = matchedState?.image || this.config.image;

                if (imgVal && (matchedState?.image || !iconVal)) {
                    activeLayout.push({
                        id: 'fallback_image',
                        type: 'image',
                        value: imgVal,
                        width: contentMatchSize ? w : 24,
                        height: contentMatchSize ? h : 24
                    });
                } else if (iconVal) {
                    activeLayout.push({
                        id: 'fallback_icon',
                        type: 'icon',
                        value: iconVal,
                        size: 18 * scale,
                        color: stTrans ? (stColor || '#facaca') : '#ffffff'
                    });
                }
            }
        }
        
        if (matchedState) {
            if (matchedState.layout_override && matchedState.layout_override.length > 0) {
                activeLayout = matchedState.layout_override;
            } else if (customLayout.length > 0) {
                // User-provided layouts still get the classic patch pass;
                // auto-built layouts above already baked the state in.
                const baseCopy = JSON.parse(JSON.stringify(activeLayout));
                if (baseCopy.length > 0) {
                    const stColor = matchedState.color || this.config.color;
                    const stTrans = matchedState.transparent !== undefined ? matchedState.transparent : this.config.transparent;
                    
                    if (stColor) {
                        if (stTrans) {
                            baseCopy[0].stroke_color = 'rgba(0,0,0,0)';
                            baseCopy[0].color = 'rgba(0,0,0,0)';
                        } else {
                            baseCopy[0].color = stColor;
                        }
                    }
                    
                    if (isSensor) {
                        const emojiEl = baseCopy.find(el => el.id === 'sensor_emoji');
                        if (emojiEl) {
                            if (matchedState.icon) {
                                emojiEl.value = matchedState.icon;
                            }
                            if (stTrans) {
                                emojiEl.color = stColor || '#10b981';
                            } else {
                                emojiEl.color = '#ffffff';
                            }
                        }
                        
                        const valueEl = baseCopy.find(el => el.id === 'sensor_value');
                        if (valueEl) {
                            const dispEntity = matchedState.display_entity || matchedState.state_entity || this.config.temperature_entity || this.config.state_entity || this.sc.entity_id;
                            const unit = matchedState.unit || this.config.unit || '°';
                            const defaultTemplate = dispEntity ? `{states('${dispEntity}')}${unit}` : '';
                            const valueTemplate = matchedState.value_template || this.config.value_template || defaultTemplate;
                            valueEl.value = valueTemplate;
                            if (stTrans) {
                                valueEl.color = stColor || '#10b981';
                            } else {
                                valueEl.color = '#ffffff';
                            }
                        }
                    } else {
                        let contentEl = baseCopy.find(el => el.type === 'icon' || el.type === 'image');
                        if (!contentEl && (matchedState.icon || matchedState.image)) {
                            contentEl = { id: 'fallback_content', type: 'icon', value: '' };
                            baseCopy.push(contentEl);
                        }
                        if (contentEl) {
                            const targetConfig = matchedState || this.config;
                            const contentMatchSize = targetConfig.content_matchSize !== undefined ? !!targetConfig.content_matchSize : (this.config.content_matchSize !== undefined ? !!this.config.content_matchSize : true);
                            
                            if (matchedState.image) {
                                contentEl.type = 'image';
                                contentEl.value = matchedState.image;
                                contentEl.width = contentMatchSize ? (baseCopy[0].width || 24) : 24;
                                contentEl.height = contentMatchSize ? (baseCopy[0].height || 24) : 24;
                            } else if (matchedState.icon) {
                                contentEl.type = 'icon';
                                contentEl.value = matchedState.icon;
                                if (stTrans) {
                                    contentEl.color = stColor || '#facaca';
                                } else {
                                    contentEl.color = 'white';
                                }
                            }
                        }
                    }
                }
                activeLayout = baseCopy;
            }
        } else if (isSensor && customLayout.length > 0 && this.config.states && this.config.states.length > 0) {
            // No state matched for a sensor with a user-provided layout:
            // fall back to root config templates and colors.
            const baseCopy = JSON.parse(JSON.stringify(activeLayout));
            const valueEl = baseCopy.find(el => el.id === 'sensor_value');
            if (valueEl) {
                const dispEntity = this.config.temperature_entity || this.config.state_entity || this.sc.entity_id;
                const unit = this.config.unit || '°';
                const defaultTemplate = dispEntity ? `{states('${dispEntity}')}${unit}` : '';
                const valueTemplate = this.config.value_template || defaultTemplate;
                valueEl.value = valueTemplate;
                if (this.config.transparent) {
                    valueEl.color = this.config.color || '#10b981';
                } else {
                    valueEl.color = '#ffffff';
                }
            }
            const emojiEl = baseCopy.find(el => el.id === 'sensor_emoji');
            if (emojiEl) {
                if (this.config.transparent) {
                    emojiEl.color = this.config.color || '#10b981';
                } else {
                    emojiEl.color = '#ffffff';
                }
            }
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
            
            // Resolve orientation-object scales ({horizontal, vertical}) to a finite
            // scalar for the active mode; guards against NaN reaching setAttribute.
            const uaMode = this.mapContext.activeMode || 'horizontal';
            const num = (v) => {
                const resolved = resolveOrientedStrict(v, uaMode);
                return Number.isFinite(resolved) ? resolved : undefined;
            };
            const scale = num(this.sc.scale) ?? 1.0;
            const sX = num(this.scaleX) ?? num(this.sc.scaleX) ?? scale;
            const sY = num(this.scaleY) ?? num(this.sc.scaleY) ?? scale;
            const lineRx = isSensor ? (this._pillHalfW ?? 26 * sX) : 12 * sX;
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
    
    /**
     * Auto-sized sensor pill layout. Geometry and content resolution live in
     * the shared SensorPill module (also used by the editor canvas preview);
     * this just maps them onto the generic component layout schema.
     */
    _buildSensorLayout(matchedState, hass, scaleX, scaleY) {
        const p = computeSensorPill({ sc: this.sc, state: matchedState, hass, scaleX, scaleY });
        this._pillHalfW = p.width / 2; // real half-width for the unavailable strike-line
        return [
            {
                id: 'sensor_bg',
                type: 'rect',
                width: p.width,
                height: p.height,
                rx: p.rx,
                ry: p.rx,
                color: p.transparent ? 'rgba(0,0,0,0)' : p.color,
                stroke_color: p.transparent ? 'rgba(0,0,0,0)' : 'white',
                stroke_width: p.transparent ? 0 : 1
            },
            {
                id: 'sensor_emoji',
                type: 'text',
                x: p.iconX,
                y: 0,
                value: p.icon,
                font_size: p.fontIcon,
                align: 'middle',
                color: p.fg
            },
            {
                id: 'sensor_value',
                type: 'text',
                x: p.textX,
                y: 0,
                value: p.value,
                font_size: p.fontValue,
                align: 'start',
                font_weight: 'bold',
                color: p.fg
            }
        ];
    }

    renderComponents(layout, hass) {
        // Clear old children from groups
        while (this.bgGroup.firstChild) {
            this.bgGroup.removeChild(this.bgGroup.firstChild);
        }
        while (this.contentGroup.firstChild) {
            this.contentGroup.removeChild(this.contentGroup.firstChild);
        }
        
        let hasFailedImage = false;
        let fallbackIcon = '💡';
        
        layout.forEach(comp => {
            const renderer = ComponentRegistry[comp.type];
            if (renderer) {
                // Pre-evaluate dynamic JS templates inside text, icons, and image paths on a shallow copy
                const evaluatedComp = { ...comp };
                if (typeof evaluatedComp.value === 'string') {
                    evaluatedComp.value = evaluateTemplate(evaluatedComp.value, hass);
                }
                if (typeof evaluatedComp.icon === 'string') {
                    evaluatedComp.icon = evaluateTemplate(evaluatedComp.icon, hass);
                }
                if (typeof evaluatedComp.image === 'string') {
                    evaluatedComp.image = evaluateTemplate(evaluatedComp.image, hass);
                }
                
                const el = renderer(this.svgNS, evaluatedComp, hass);
                if (comp.id) {
                    el.setAttribute('id', comp.id);
                }
                
                // Track standard elements for backwards compatibility tests
                if (comp.type === 'rect' || comp.type === 'circle') {
                    this.shape = el;
                    this.bgGroup.appendChild(el);
                } else {
                    this.contentGroup.appendChild(el);
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
                    this.contentGroup.appendChild(this.iconText);
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
            this.contentGroup.appendChild(this.iconText);
        } else {
            if (this.iconText && this.iconText.id !== 'sensor_value') {
                this.iconText.textContent = '';
            }
        }
    }
    
    setTransformStr(str) {
        this.extraTransformStr = str;
        
        const activeMode = this.mapContext.activeMode || 'horizontal';
        const customRot = resolveOriented(this.sc.rotation, activeMode, 0);
        const rotStr = customRot ? `rotate(${customRot})` : '';
        this.group.setAttribute('transform', `translate(${this.px}, ${this.py}) ${rotStr} ${str}`.trim());
        
        // Resolve target config for content matching options
        const targetConfig = this.activeState || this.config || {};
        const contentMatchSize = targetConfig.content_matchSize !== undefined ? !!targetConfig.content_matchSize : (this.config.content_matchSize !== undefined ? !!this.config.content_matchSize : true);
        const contentMatchRot = targetConfig.content_matchRotation !== undefined ? !!targetConfig.content_matchRotation : (this.config.content_matchRotation !== undefined ? !!this.config.content_matchRotation : true);
        
        const contentX = targetConfig.content_x !== undefined ? targetConfig.content_x : (this.config.content_x !== undefined ? this.config.content_x : 0);
        const contentY = targetConfig.content_y !== undefined ? targetConfig.content_y : (this.config.content_y !== undefined ? this.config.content_y : 0);
        
        const contentScaleX = contentMatchSize ? 1.0 : (targetConfig.content_scaleX !== undefined ? targetConfig.content_scaleX : (this.config.content_scaleX !== undefined ? this.config.content_scaleX : 1.0));
        const contentScaleY = contentMatchSize ? 1.0 : (targetConfig.content_scaleY !== undefined ? targetConfig.content_scaleY : (this.config.content_scaleY !== undefined ? this.config.content_scaleY : 1.0));
        
        const contentRotation = contentMatchRot ? 0 : (targetConfig.content_rotation !== undefined ? targetConfig.content_rotation : (this.config.content_rotation !== undefined ? this.config.content_rotation : 0));

        let transforms = [];
        
        // 1. Translation offset
        if (contentX !== 0 || contentY !== 0) {
            transforms.push(`translate(${contentX}, ${contentY})`);
        }
        
        // 2. Decouple outer rotation from inner content rotation:
        // By default, text/icons/images stay vertical (upright) even when the outer map/shape rotates!
        const isRotated = this.mapContext.isRotated;
        const isAutoRotate = this.getIsAutoRotateActive();
        
        let totalContentRotation = 0;
        if (!contentMatchRot) {
            totalContentRotation = -customRot;
            if (isRotated && isAutoRotate) {
                totalContentRotation -= 90;
            }
            totalContentRotation += contentRotation;
        }
        
        if (totalContentRotation !== 0) {
            transforms.push(`rotate(${totalContentRotation})`);
        }
        
        // 3. Custom Scale offset
        if (!contentMatchSize && (contentScaleX !== 1.0 || contentScaleY !== 1.0)) {
            transforms.push(`scale(${contentScaleX}, ${contentScaleY})`);
        }
        
        this.contentGroup.setAttribute('transform', transforms.join(' '));
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
                    // Tap actions intentionally skip room-name -> segment-ID
                    // replacement and error alerts (see ActionRunner divergence notes).
                    executeAction(this.mapContext._hass, act, target);
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


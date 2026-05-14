export class MapShortcut {
    constructor(scData, svgNS, imgW, imgH, mapContext) {
        this.sc = scData;
        this.svgNS = svgNS;
        this.imgW = imgW;
        this.imgH = imgH;
        this.mapContext = mapContext;
        this.group = document.createElementNS(svgNS, 'g');
        
        // Base positioning
        this.px = (scData.position[0] / 100) * imgW;
        this.py = (scData.position[1] / 100) * imgH;
        this.group.scX = this.px;
        this.group.scY = this.py;
        this.rotation = 0;
        this.group.setAttribute('transform', `translate(${this.px}, ${this.py}) rotate(${this.rotation})`);
        
        this.scaleX = scData.scaleX || scData.scale || 1;
        this.scaleY = scData.scaleY || scData.scale || 1;
        this.rx = 12 * this.scaleX;
        this.ry = 12 * this.scaleY;
        
        // Configuration
        this.config = scData.config || {};
        
        // State badge for overlays
        this.stateBadge = document.createElementNS(svgNS, 'text');
        this.stateBadge.setAttribute('text-anchor', 'middle');
        this.stateBadge.setAttribute('dominant-baseline', 'central');
        this.stateBadge.setAttribute('font-size', 12);
        this.stateBadge.setAttribute('y', Math.max(this.rx, this.ry) + 14);
        this.stateBadge.setAttribute('fill', '#1e293b');
        this.stateBadge.style.textShadow = '0px 0px 2px white';
        
        this.group.classList.add('shortcut-group');
        this.setupInteractions();
    }
    
    setRotation(deg) {
        this.rotation = deg;
        this.group.setAttribute('transform', `translate(${this.px}, ${this.py}) rotate(${this.rotation})`);
    }

    setTransformStr(str) {
        this.group.setAttribute('transform', `translate(${this.px}, ${this.py}) ${str}`);
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

    render() {
        this.group.appendChild(this.stateBadge);
        return this.group;
    }
    
    updateState(hass) {
        this.activeState = this.evaluateStates(hass);
    }
    
    evaluateStates(hass) {
        if (!this.config.states || !this.config.states.length) return null;
        for (const st of this.config.states) {
            const entity = st.state_entity;
            if (!entity || !hass.states[entity]) continue;
            const actualVal = hass.states[entity].state;
            const targetVal = st.value;
            let matched = false;
            if (st.operator === '==') matched = (actualVal == targetVal);
            if (st.operator === '!=') matched = (actualVal != targetVal);
            if (matched) return st;
        }
        return null;
    }
    
    onClick(e) {
        if (this.config.actions && this.config.actions.length > 0) {
            const tapActions = this.config.actions.filter(a => a.trigger === 'tap');
            if (tapActions.length > 0) {
                // Execute instant actions (toggle/call_service)
                tapActions.forEach(act => {
                    const target = act.action_entity || this.sc.entity_id;
                    if (!target || !this.mapContext._hass) return;
                    if (act.type === 'CALL_SERVICE' && act.service) {
                        const parts = act.service.split('.');
                        if (parts.length === 2) {
                            let payload = { entity_id: target };
                            if (act.payload) {
                                try {
                                    const parsed = JSON.parse(act.payload);
                                    payload = { ...payload, ...parsed };
                                } catch (e) {
                                    console.error("[DynamicMap] Failed to parse action payload:", e);
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
                            else if (service === 'toggle') service = 'start_pause';
                        }
                        
                        this.mapContext._hass.callService(domain, service, { entity_id: target });
                    }
                });
                
                // If there are sliders configured on tap, pop up an overlay for them
                const sliderActions = tapActions.filter(a => a.type === 'SLIDER');
                if (sliderActions.length > 0 && this.mapContext.showOverlay) {
                    this.mapContext.showOverlay(this, sliderActions, e);
                }
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
            // Default HA more-info dialog
            if (this.sc.entity_id && this.mapContext._hass) {
                const event = new Event('hass-more-info', { bubbles: true, composed: true });
                event.detail = { entityId: this.sc.entity_id };
                this.mapContext.dispatchEvent(event);
            }
        }
    }
}

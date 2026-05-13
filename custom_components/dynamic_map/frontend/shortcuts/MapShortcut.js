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
        this.group.setAttribute('transform', `translate(${this.px}, ${this.py})`);
        
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
    
    setupInteractions() {
        this.group.style.cursor = 'pointer';
        let pressTimer;
        let isDragging = false;
        
        this.group.addEventListener('pointerdown', (e) => {
            isDragging = false;
            pressTimer = window.setTimeout(() => {
                pressTimer = null;
                this.onLongPress(e);
            }, 500);
        });
        
        this.group.addEventListener('pointermove', (e) => {
            isDragging = true;
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        });
        
        this.group.addEventListener('pointerup', (e) => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                if (!isDragging) this.onClick(e);
            }
            e.stopPropagation();
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
            const entity = st.state_entity || st.condition_entity;
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
                tapActions.forEach(act => {
                    const target = act.action_entity || act.target || this.sc.entity_id;
                    if (!target || !this.mapContext._hass) return;
                    if (act.type === 'CALL_SERVICE' && act.service) {
                        const parts = act.service.split('.');
                        if (parts.length === 2) {
                            this.mapContext._hass.callService(parts[0], parts[1], { entity_id: target });
                        }
                    } else if (act.type && act.type.startsWith('TOGGLE')) {
                        const domain = target.split('.')[0];
                        const service = act.type === 'TOGGLE_ON' ? 'turn_on' : (act.type === 'TOGGLE_OFF' ? 'turn_off' : 'toggle');
                        this.mapContext._hass.callService(domain, service, { entity_id: target });
                    }
                });
                return;
            }
        }
        // Fallback default action
        if (this.sc.entity_id && this.mapContext._hass) {
            const domain = this.sc.entity_id.split('.')[0];
            this.mapContext._hass.callService(domain, 'toggle', { entity_id: this.sc.entity_id });
        }
    }

    onLongPress(e) {
        if (!this.config.actions) return;
        const overlayActions = this.config.actions.filter(a => a.trigger === 'overlay');
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

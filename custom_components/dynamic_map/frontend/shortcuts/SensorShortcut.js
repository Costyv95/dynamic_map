import { MapShortcut } from './MapShortcut.js';

export class SensorShortcut extends MapShortcut {
    render() {
        // Renders a premium rounded pill shape
        this.shape = document.createElementNS(this.svgNS, 'rect');
        
        this.rx = 26 * this.scaleX;
        this.ry = 12 * this.scaleY;
        
        this.shape.setAttribute('x', -this.rx);
        this.shape.setAttribute('y', -this.ry);
        this.shape.setAttribute('width', this.rx * 2);
        this.shape.setAttribute('height', this.ry * 2);
        
        const borderRadius = 8 * Math.min(this.scaleX, this.scaleY);
        this.shape.setAttribute('rx', borderRadius);
        this.shape.setAttribute('ry', borderRadius);
        
        this.shape.setAttribute('fill', this.config.transparent ? 'rgba(0,0,0,0)' : (this.config.color || '#0ea5e9'));
        this.shape.setAttribute('stroke', 'white');
        this.shape.setAttribute('stroke-width', 2);
        this.bgGroup.appendChild(this.shape);
        
        // Renders formatted sensor value text on the right side of the pill
        this.iconText = document.createElementNS(this.svgNS, 'text');
        this.iconText.setAttribute('text-anchor', 'middle');
        this.iconText.setAttribute('dominant-baseline', 'central');
        this.iconText.setAttribute('font-size', 11 * Math.min(this.scaleX, this.scaleY));
        this.iconText.setAttribute('font-weight', 'bold');
        this.iconText.style.pointerEvents = 'none';
        this.iconGroup.appendChild(this.iconText);
        
        // Renders sensor icon on the left side of the pill
        this.iconForeignObject = document.createElementNS(this.svgNS, 'foreignObject');
        const foSize = 16 * Math.min(this.scaleX, this.scaleY);
        this.iconForeignObject.setAttribute('width', foSize);
        this.iconForeignObject.setAttribute('height', foSize);
        this.iconForeignObject.setAttribute('x', -18 * this.scaleX);
        this.iconForeignObject.setAttribute('y', -foSize / 2);
        this.iconForeignObject.style.pointerEvents = 'none';
        this.iconForeignObject.style.display = 'none';
        
        this.haIcon = document.createElement('ha-icon');
        this.haIcon.style.cssText = `display:flex; width:100%; height:100%; color: white; --mdc-icon-size: ${foSize}px; align-items:center; justify-content:center;`;
        this.iconForeignObject.appendChild(this.haIcon);
        this.iconGroup.appendChild(this.iconForeignObject);
        
        // Renders fallback text/emoji for the icon on the left side of the pill
        this.emojiText = document.createElementNS(this.svgNS, 'text');
        this.emojiText.setAttribute('text-anchor', 'middle');
        this.emojiText.setAttribute('dominant-baseline', 'central');
        this.emojiText.setAttribute('font-size', 12 * Math.min(this.scaleX, this.scaleY));
        this.emojiText.setAttribute('x', -12 * this.scaleX);
        this.emojiText.setAttribute('y', 0);
        this.emojiText.style.pointerEvents = 'none';
        this.emojiText.style.display = 'block';
        this.iconGroup.appendChild(this.emojiText);

        // Add visual strike-through line for unavailable states
        this.unavailableLine = document.createElementNS(this.svgNS, 'line');
        this.unavailableLine.setAttribute('stroke', '#ef4444');
        this.unavailableLine.setAttribute('stroke-width', 2.5);
        this.unavailableLine.setAttribute('stroke-linecap', 'round');
        this.unavailableLine.style.pointerEvents = 'none';
        this.unavailableLine.style.display = 'none';
        this.iconGroup.appendChild(this.unavailableLine);
        
        // State badge underneath the pill
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

        this.rx = 26 * activeScaleX;
        this.ry = 12 * activeScaleY;

        if (this.shape) {
            this.shape.setAttribute('x', -this.rx);
            this.shape.setAttribute('y', -this.ry);
            this.shape.setAttribute('width', this.rx * 2);
            this.shape.setAttribute('height', this.ry * 2);
            
            const borderRadius = 8 * Math.min(activeScaleX, activeScaleY);
            this.shape.setAttribute('rx', borderRadius);
            this.shape.setAttribute('ry', borderRadius);
        }
        
        if (this.iconText) {
            this.iconText.setAttribute('font-size', 11 * Math.min(activeScaleX, activeScaleY));
            this.iconText.setAttribute('x', 8 * activeScaleX);
        }
        
        if (this.emojiText) {
            this.emojiText.setAttribute('font-size', 12 * Math.min(activeScaleX, activeScaleY));
            this.emojiText.setAttribute('x', -12 * activeScaleX);
        }
        
        if (this.iconForeignObject) {
            const foSize = 16 * Math.min(activeScaleX, activeScaleY);
            this.iconForeignObject.setAttribute('width', foSize);
            this.iconForeignObject.setAttribute('height', foSize);
            this.iconForeignObject.setAttribute('x', -20 * activeScaleX);
            this.iconForeignObject.setAttribute('y', -foSize / 2);
            if (this.haIcon) {
                this.haIcon.style.cssText = `display:flex; width:100%; height:100%; color: white; --mdc-icon-size: ${foSize}px; align-items:center; justify-content:center;`;
            }
        }
        
        // Dynamic value entity resolution from activeState display_entity or fallback to root entity_id
        const displayEntity = this.activeState?.display_entity || this.sc.entity_id;
        const stateObj = displayEntity ? hass.states[displayEntity] : null;
        const val = stateObj ? stateObj.state : '--';
        const isUnavailable = !!(displayEntity && hass.states[displayEntity] &&
            (hass.states[displayEntity].state === 'unavailable' || hass.states[displayEntity].state === 'unknown'));

        // Format state value based on unit configured in activeState or read from HA state attributes
        let unit = '';
        if (this.activeState && this.activeState.unit !== undefined) {
            unit = this.activeState.unit;
        } else if (stateObj && stateObj.attributes && stateObj.attributes.unit_of_measurement) {
            unit = stateObj.attributes.unit_of_measurement;
        }
        
        let formattedVal = val;
        const numericVal = parseFloat(val);
        if (!isNaN(numericVal)) {
            formattedVal = `${numericVal.toFixed(0)}${unit}`;
        } else if (val !== '--') {
            formattedVal = `${val}${unit}`;
        }
        this.iconText.textContent = formattedVal;

        // Resolve colors and icons
        let color = this.config.color || '#0ea5e9';
        let icon = this.config.icon || '🌡️';
        
        if (this.activeState) {
            if (this.activeState.color) color = this.activeState.color;
            if (this.activeState.icon) icon = this.activeState.icon;
        }

        // Apply colors based on transparency config
        if (!this.config.transparent) {
            this.shape.setAttribute('fill', color);
            this.shape.setAttribute('stroke', 'white');
            this.iconText.setAttribute('fill', 'white');
            this.emojiText.setAttribute('fill', 'white');
            this.haIcon.style.color = 'white';
        } else {
            this.shape.setAttribute('fill', 'rgba(0,0,0,0)');
            this.shape.setAttribute('stroke', 'rgba(0,0,0,0)');
            this.iconText.setAttribute('fill', color);
            this.emojiText.setAttribute('fill', color);
            this.haIcon.style.color = color;
        }

        // Show SVG icon or plain text emoji
        if (icon.startsWith('mdi:') || icon.includes(':')) {
            this.emojiText.style.display = 'none';
            this.haIcon.setAttribute('icon', icon);
            this.iconForeignObject.style.display = 'block';
        } else {
            this.iconForeignObject.style.display = 'none';
            this.emojiText.textContent = icon;
            this.emojiText.style.display = 'block';
        }

        // Handle unavailable overlays
        if (isUnavailable) {
            const contentFilter = 'grayscale(100%) opacity(45%)';
            this.bgGroup.style.filter = contentFilter;
            if (this.iconForeignObject) this.iconForeignObject.style.filter = contentFilter;
            if (this.iconText) this.iconText.style.filter = contentFilter;
            if (this.emojiText) this.emojiText.style.filter = contentFilter;
            
            if (this.unavailableLine) {
                this.unavailableLine.setAttribute('x1', -this.rx * 0.7);
                this.unavailableLine.setAttribute('y1', -this.ry * 0.7);
                this.unavailableLine.setAttribute('x2', this.rx * 0.7);
                this.unavailableLine.setAttribute('y2', this.ry * 0.7);
                this.unavailableLine.style.display = 'block';
            }
        } else {
            this.bgGroup.style.filter = '';
            if (this.iconForeignObject) this.iconForeignObject.style.filter = '';
            if (this.iconText) this.iconText.style.filter = '';
            if (this.emojiText) this.emojiText.style.filter = '';
            if (this.unavailableLine) {
                this.unavailableLine.style.display = 'none';
            }
        }
        
        return true;
    }

    getIsAutoRotateActive() {
        if (this.activeState && this.activeState.autoRotate !== undefined) {
            return !!this.activeState.autoRotate;
        }
        return !!(this.config && this.config.autoRotate);
    }

    onClick(e) {
        if (this.sc.entity_id && this.mapContext._hass) {
            const domain = this.sc.entity_id.split('.')[0];
            this.mapContext._hass.callService(domain, 'toggle', { entity_id: this.sc.entity_id }).catch(err => {
                console.error("[DynamicMap] Sensor tap toggle error:", err);
            });
        } else {
            super.onClick(e);
        }
    }
}


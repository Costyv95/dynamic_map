import { GenericShortcut } from './GenericShortcut.js';

export class LightShortcut extends GenericShortcut {
    // LightShortcut currently inherits the exact same logic as GenericShortcut,
    // but having it isolated allows for easy expansion in the future (e.g., custom animations).
    
    // For now, it simply overrides the default fallback icon to 💡
    updateState(hass) {
        super.updateState(hass);
        
        let color = this.config.color || '#475569';
        let icon = '💡';
        
        if (this.activeState) {
            if (this.activeState.color) color = this.activeState.color;
            if (this.activeState.icon) icon = this.activeState.icon;
        } else if (this.sc.entity_id && hass.states[this.sc.entity_id]) {
            const stateObj = hass.states[this.sc.entity_id];
            if (stateObj.state === 'on') {
                color = '#fbbf24';
            } else {
                color = '#475569';
            }
        }
        
        if (!this.config.transparent) {
            this.shape.setAttribute('fill', color);
        }
        this.iconText.textContent = icon;
    }
}

import { GenericShortcut } from './GenericShortcut.js';

export class LightShortcut extends GenericShortcut {
    // LightShortcut currently inherits the exact same logic as GenericShortcut,
    // but having it isolated allows for easy expansion in the future (e.g., custom animations).
    
    // For now, it simply overrides the default fallback icon to 💡
    updateState(hass) {
        super.updateState(hass);
        
        let color = this.config.color || '#475569';
        let icon = this.config.icon || '💡';
        
        if (this.activeState) {
            if (this.activeState.color) color = this.activeState.color;
            if (this.activeState.icon) icon = this.activeState.icon;
        }
        
        if (!this.config.transparent) {
            this.shape.setAttribute('fill', color);
        } else {
            this.shape.setAttribute('fill', 'rgba(0,0,0,0)');
        }
        
        if (icon.startsWith('http') || icon.startsWith('/') || icon.endsWith('.png') || icon.endsWith('.svg') || icon.endsWith('.jpg') || icon.endsWith('.webp')) {
            this.iconText.textContent = '';
            this.iconImage.setAttribute('href', icon);
            this.iconImage.style.display = 'block';
        } else {
            this.iconText.textContent = icon;
            this.iconImage.style.display = 'none';
        }
    }
}

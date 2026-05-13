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
        this.group.appendChild(this.shape);
        
        this.iconText = document.createElementNS(this.svgNS, 'text');
        this.iconText.setAttribute('text-anchor', 'middle');
        this.iconText.setAttribute('dominant-baseline', 'central');
        this.iconText.setAttribute('font-size', 14 * Math.min(this.scaleX, this.scaleY));
        this.iconText.textContent = '💡';
        this.group.appendChild(this.iconText);
        
        super.render();
        return this.group;
    }
    
    updateState(hass) {
        super.updateState(hass);
        
        let color = this.config.color || '#0ea5e9';
        let icon = '💡';
        
        if (this.activeState) {
            if (this.activeState.color) color = this.activeState.color;
            if (this.activeState.icon) icon = this.activeState.icon;
        }
        
        if (!this.config.transparent) {
            this.shape.setAttribute('fill', color);
        }
        this.iconText.textContent = icon;
    }
}

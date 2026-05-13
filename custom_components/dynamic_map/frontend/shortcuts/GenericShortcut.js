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
        this.iconText.setAttribute('font-size', 16 * Math.min(this.scaleX, this.scaleY));
        this.iconText.style.pointerEvents = 'none';
        this.group.appendChild(this.iconText);
        
        this.iconImage = document.createElementNS(this.svgNS, 'image');
        const imgSize = 20 * Math.min(this.scaleX, this.scaleY);
        this.iconImage.setAttribute('width', imgSize);
        this.iconImage.setAttribute('height', imgSize);
        this.iconImage.setAttribute('x', -imgSize / 2);
        this.iconImage.setAttribute('y', -imgSize / 2);
        this.iconImage.style.pointerEvents = 'none';
        this.iconImage.style.display = 'none';
        this.group.appendChild(this.iconImage);
        
        super.render();
        return this.group;
    }
    
    updateState(hass) {
        super.updateState(hass);
        
        let color = this.config.color || '#0ea5e9';
        let icon = this.config.icon || '';
        
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

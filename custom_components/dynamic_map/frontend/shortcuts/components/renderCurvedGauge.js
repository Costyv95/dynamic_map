export function renderCurvedGauge(svgNS, props, hass) {
    const group = document.createElementNS(svgNS, 'g');
    const radius = props.radius || 18;
    const strokeWidth = props.stroke_width || 3;
    
    // We draw a 180-degree semicircular arc sweeping from left to right (top-half)
    // Semicircular length is PI * radius
    const arcLength = Math.PI * radius;
    
    // Background track arc
    const track = document.createElementNS(svgNS, 'circle');
    track.setAttribute('cx', props.x || 0);
    track.setAttribute('cy', props.y || 0);
    track.setAttribute('r', radius);
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', props.track_color || '#e2e8f0');
    track.setAttribute('stroke-width', strokeWidth);
    track.setAttribute('stroke-dasharray', `${arcLength} ${2 * Math.PI * radius}`);
    track.setAttribute('transform', `rotate(180, ${props.x || 0}, ${props.y || 0})`);
    group.appendChild(track);
    
    // Active filled progress arc
    const progress = document.createElementNS(svgNS, 'circle');
    progress.setAttribute('cx', props.x || 0);
    progress.setAttribute('cy', props.y || 0);
    progress.setAttribute('r', radius);
    progress.setAttribute('fill', 'none');
    progress.setAttribute('stroke', props.color || '#3b82f6');
    progress.setAttribute('stroke-width', strokeWidth);
    progress.setAttribute('stroke-dasharray', `${arcLength} ${2 * Math.PI * radius}`);
    progress.setAttribute('transform', `rotate(180, ${props.x || 0}, ${props.y || 0})`);
    
    let value = parseFloat(props.value) || 0;
    if (props.entity && hass && hass.states[props.entity]) {
        value = parseFloat(hass.states[props.entity].state) || 0;
    }
    
    const min = props.min !== undefined ? props.min : 0;
    const max = props.max !== undefined ? props.max : 100;
    const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    
    const offset = arcLength - (pct / 100) * arcLength;
    progress.setAttribute('stroke-dashoffset', offset);
    progress.style.transition = 'stroke-dashoffset 0.5s ease-in-out';
    group.appendChild(progress);
    
    return group;
}

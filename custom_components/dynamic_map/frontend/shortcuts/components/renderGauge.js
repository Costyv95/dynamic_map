export function renderGauge(svgNS, props, hass) {
    const group = document.createElementNS(svgNS, 'g');
    const radius = props.radius || 18;
    const strokeWidth = props.stroke_width || 3;
    const circumference = 2 * Math.PI * radius;
    
    // Background track ring
    const track = document.createElementNS(svgNS, 'circle');
    track.setAttribute('cx', props.x || 0);
    track.setAttribute('cy', props.y || 0);
    track.setAttribute('r', radius);
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', props.track_color || '#e2e8f0');
    track.setAttribute('stroke-width', strokeWidth);
    group.appendChild(track);
    
    // Active filled progress ring
    const progress = document.createElementNS(svgNS, 'circle');
    progress.setAttribute('cx', props.x || 0);
    progress.setAttribute('cy', props.y || 0);
    progress.setAttribute('r', radius);
    progress.setAttribute('fill', 'none');
    progress.setAttribute('stroke', props.color || '#3b82f6');
    progress.setAttribute('stroke-width', strokeWidth);
    progress.setAttribute('stroke-dasharray', circumference);
    progress.setAttribute('transform', `rotate(-90, ${props.x || 0}, ${props.y || 0})`);
    
    let value = parseFloat(props.value) || 0;
    if (props.entity && hass && hass.states[props.entity]) {
        value = parseFloat(hass.states[props.entity].state) || 0;
    }
    
    const min = props.min !== undefined ? props.min : 0;
    const max = props.max !== undefined ? props.max : 100;
    const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    const offset = circumference - (pct / 100) * circumference;
    
    progress.setAttribute('stroke-dashoffset', offset);
    progress.style.transition = 'stroke-dashoffset 0.5s ease-in-out';
    group.appendChild(progress);
    
    return group;
}

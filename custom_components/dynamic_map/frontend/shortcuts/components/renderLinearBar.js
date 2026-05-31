export function renderLinearBar(svgNS, props, hass) {
    const group = document.createElementNS(svgNS, 'g');
    const width = props.width || 40;
    const height = props.height || 4;
    const rx = props.rx !== undefined ? props.rx : height / 2;
    
    // Background track bar
    const track = document.createElementNS(svgNS, 'rect');
    track.setAttribute('x', (props.x || 0) - width / 2);
    track.setAttribute('y', (props.y || 0) - height / 2);
    track.setAttribute('width', width);
    track.setAttribute('height', height);
    track.setAttribute('rx', rx);
    track.setAttribute('ry', rx);
    track.setAttribute('fill', props.track_color || '#e2e8f0');
    group.appendChild(track);
    
    // Active filled progress bar
    const progress = document.createElementNS(svgNS, 'rect');
    progress.setAttribute('x', (props.x || 0) - width / 2);
    progress.setAttribute('y', (props.y || 0) - height / 2);
    progress.setAttribute('height', height);
    progress.setAttribute('rx', rx);
    progress.setAttribute('ry', rx);
    progress.setAttribute('fill', props.color || '#3b82f6');
    
    let value = parseFloat(props.value) || 0;
    if (props.entity && hass && hass.states[props.entity]) {
        value = parseFloat(hass.states[props.entity].state) || 0;
    }
    
    const min = props.min !== undefined ? props.min : 0;
    const max = props.max !== undefined ? props.max : 100;
    const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    
    progress.setAttribute('width', (pct / 100) * width);
    progress.style.transition = 'width 0.5s ease-in-out';
    group.appendChild(progress);
    
    return group;
}

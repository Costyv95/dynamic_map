export function renderLinePath(svgNS, props, hass) {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', props.color || '#3b82f6');
    path.setAttribute('stroke-width', props.stroke_width || 2);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    if (props.dashed) {
        path.setAttribute('stroke-dasharray', props.dash_style || '5,5');
    }
    
    let d = props.value || '';
    
    // If the path value is bound to a Home Assistant entity (like vacuum path trace attribute)
    if (props.entity && hass && hass.states[props.entity]) {
        const stateObj = hass.states[props.entity];
        if (stateObj.attributes && stateObj.attributes.path) {
            // Assume path is an array of points: [[x,y], [x,y]]
            const pts = stateObj.attributes.path;
            if (Array.isArray(pts) && pts.length > 0) {
                d = pts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`).join(' ');
            }
        }
    }
    
    path.setAttribute('d', d || 'M0,0');
    path.style.transition = 'd 0.3s ease';
    return path;
}

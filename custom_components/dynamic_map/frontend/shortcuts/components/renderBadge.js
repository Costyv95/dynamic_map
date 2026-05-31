export function renderBadge(svgNS, props, hass) {
    const group = document.createElementNS(svgNS, 'g');
    const radius = props.radius || 5;
    
    // Position of the badge is typically offset from parent center
    const bx = (props.x || 0) + (props.offset_x || 10);
    const by = (props.y || 0) + (props.offset_y || -10);
    
    let isVisible = true;
    if (props.entity && hass && hass.states[props.entity]) {
        const stateVal = hass.states[props.entity].state;
        if (props.hide_on === stateVal) {
            isVisible = false;
        }
    }
    
    if (isVisible) {
        const badge = document.createElementNS(svgNS, 'circle');
        badge.setAttribute('cx', bx);
        badge.setAttribute('cy', by);
        badge.setAttribute('r', radius);
        badge.setAttribute('fill', props.color || '#ef4444');
        badge.setAttribute('stroke', '#ffffff');
        badge.setAttribute('stroke-width', 1);
        group.appendChild(badge);
        
        if (props.label) {
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', bx);
            text.setAttribute('y', by);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.setAttribute('fill', '#ffffff');
            text.setAttribute('font-size', props.font_size || 8);
            text.setAttribute('font-weight', 'bold');
            text.textContent = props.label;
            group.appendChild(text);
        }
    }
    
    return group;
}

export function renderText(svgNS, props, hass) {
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', props.x || 0);
    text.setAttribute('y', props.y || 0);
    text.setAttribute('text-anchor', props.align || 'middle');
    text.setAttribute('dominant-baseline', props.baseline || 'central');
    text.setAttribute('fill', props.color || '#ffffff');
    text.setAttribute('font-size', props.font_size || 12);
    text.setAttribute('font-weight', props.font_weight || 'normal');
    
    // Evaluate simple Home Assistant state template tokens: e.g. {{ states('sensor.X') }}
    let displayValue = props.value || '';
    if (displayValue.includes('states(') && hass) {
        const match = displayValue.match(/states\(['"]([^'"]+)['"]\)/);
        if (match && match[1] && hass.states[match[1]]) {
            const stateObj = hass.states[match[1]];
            const suffix = displayValue.split('}}')[1] || '';
            displayValue = stateObj.state + suffix;
        }
    }
    
    text.textContent = displayValue;
    return text;
}

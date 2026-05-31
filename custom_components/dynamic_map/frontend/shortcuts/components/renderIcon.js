export function renderIcon(svgNS, props) {
    const size = props.size || 18;
    const foreign = document.createElementNS(svgNS, 'foreignObject');
    foreign.setAttribute('x', (props.x || 0) - size / 2);
    foreign.setAttribute('y', (props.y || 0) - size / 2);
    foreign.setAttribute('width', size);
    foreign.setAttribute('height', size);
    
    const icon = document.createElement('ha-icon');
    icon.setAttribute('icon', props.value || 'mdi:power');
    icon.style.color = props.color || '#ffffff';
    icon.style.setProperty('--mdc-icon-size', `${size}px`);
    icon.style.display = 'block';
    
    foreign.appendChild(icon);
    return foreign;
}

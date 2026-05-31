export function renderRect(svgNS, props) {
    const width = props.width || 24;
    const height = props.height || 24;
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', (props.x || 0) - width / 2);
    rect.setAttribute('y', (props.y || 0) - height / 2);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('rx', props.rx || 0);
    rect.setAttribute('ry', props.ry || 0);
    rect.setAttribute('fill', props.color || '#475569');
    rect.setAttribute('stroke', props.stroke_color || 'none');
    rect.setAttribute('stroke-width', props.stroke_width || 0);
    rect.style.transition = 'fill 0.3s ease, width 0.3s ease, height 0.3s ease';
    return rect;
}

export function renderPill(svgNS, props) {
    const width = props.width || 50;
    const height = props.height || 24;
    const pill = document.createElementNS(svgNS, 'rect');
    pill.setAttribute('x', (props.x || 0) - width / 2);
    pill.setAttribute('y', (props.y || 0) - height / 2);
    pill.setAttribute('width', width);
    pill.setAttribute('height', height);
    pill.setAttribute('rx', height / 2);
    pill.setAttribute('ry', height / 2);
    pill.setAttribute('fill', props.color || '#475569');
    pill.setAttribute('stroke', props.stroke_color || 'none');
    pill.setAttribute('stroke-width', props.stroke_width || 0);
    pill.style.transition = 'fill 0.3s ease, width 0.3s ease';
    return pill;
}

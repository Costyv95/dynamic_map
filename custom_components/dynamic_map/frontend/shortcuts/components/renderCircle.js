export function renderCircle(svgNS, props) {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', props.x || 0);
    circle.setAttribute('cy', props.y || 0);
    circle.setAttribute('r', props.radius || 12);
    circle.setAttribute('fill', props.color || '#475569');
    circle.setAttribute('stroke', props.stroke_color || 'none');
    circle.setAttribute('stroke-width', props.stroke_width || 0);
    circle.style.transition = 'fill 0.3s ease, r 0.3s ease';
    return circle;
}

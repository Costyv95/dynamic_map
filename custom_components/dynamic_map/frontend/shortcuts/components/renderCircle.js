export function renderCircle(svgNS, props) {
    const rx = props.radiusX !== undefined ? props.radiusX : (props.radius || 12);
    const ry = props.radiusY !== undefined ? props.radiusY : (props.radius || 12);
    
    if (rx !== ry) {
        const ellipse = document.createElementNS(svgNS, 'ellipse');
        ellipse.setAttribute('cx', props.x || 0);
        ellipse.setAttribute('cy', props.y || 0);
        ellipse.setAttribute('rx', rx);
        ellipse.setAttribute('ry', ry);
        ellipse.setAttribute('fill', props.color || '#475569');
        ellipse.setAttribute('stroke', props.stroke_color || 'none');
        ellipse.setAttribute('stroke-width', props.stroke_width || 0);
        ellipse.style.transition = 'fill 0.3s ease, rx 0.3s ease, ry 0.3s ease';
        return ellipse;
    }
    
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

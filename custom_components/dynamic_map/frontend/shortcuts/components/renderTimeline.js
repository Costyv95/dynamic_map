export function renderTimeline(svgNS, props, hass) {
    const group = document.createElementNS(svgNS, 'g');
    const x = props.x || 0;
    const y = props.y || 0;
    const width = props.width || 120;
    const height = props.height || 24;
    const scale = props.scale || 1.0;
    
    // Configurable schedule nodes (defaults to Morning, Afternoon, Evening if empty)
    const nodes = props.nodes || [
        { label: '08:00', key: 'morning' },
        { label: '13:00', key: 'day' },
        { label: '19:00', key: 'evening' },
        { label: '23:00', key: 'night' }
    ];
    
    let activeIndex = 0;
    if (props.entity && hass && hass.states[props.entity]) {
        const stateVal = String(hass.states[props.entity].state).toLowerCase();
        const found = nodes.findIndex(n => String(n.key).toLowerCase() === stateVal || String(n.label).toLowerCase() === stateVal);
        if (found !== -1) {
            activeIndex = found;
        }
    } else if (props.active_index !== undefined) {
        activeIndex = parseInt(props.active_index) || 0;
    }
    
    // Draw background track bar
    const bar = document.createElementNS(svgNS, 'rect');
    bar.setAttribute('x', x - (width / 2) * scale);
    bar.setAttribute('y', y - 2 * scale);
    bar.setAttribute('width', width * scale);
    bar.setAttribute('height', 4 * scale);
    bar.setAttribute('rx', 2 * scale);
    bar.setAttribute('ry', 2 * scale);
    bar.setAttribute('fill', props.track_color || 'rgba(255, 255, 255, 0.15)');
    group.appendChild(bar);
    
    // Draw active progress fill
    const fillWidth = nodes.length > 1 ? (activeIndex / (nodes.length - 1)) * width * scale : 0;
    if (fillWidth > 0) {
        const progress = document.createElementNS(svgNS, 'rect');
        progress.setAttribute('x', x - (width / 2) * scale);
        progress.setAttribute('y', y - 2 * scale);
        progress.setAttribute('width', fillWidth);
        progress.setAttribute('height', 4 * scale);
        progress.setAttribute('rx', 2 * scale);
        progress.setAttribute('ry', 2 * scale);
        progress.setAttribute('fill', props.color || '#10b981');
        progress.style.transition = 'width 0.4s ease';
        group.appendChild(progress);
    }
    
    // Draw node circular markers and time labels
    const step = nodes.length > 1 ? (width * scale) / (nodes.length - 1) : 0;
    
    nodes.forEach((node, i) => {
        const nx = x - (width / 2) * scale + i * step;
        const isPastOrActive = i <= activeIndex;
        const isActive = i === activeIndex;
        
        // Node dot
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', nx);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', (isActive ? 5 : 4) * scale);
        circle.setAttribute('fill', isActive ? '#ffffff' : (isPastOrActive ? (props.color || '#10b981') : '#475569'));
        circle.setAttribute('stroke', isActive ? (props.color || '#10b981') : 'rgba(0,0,0,0.2)');
        circle.setAttribute('stroke-width', isActive ? '2' : '1');
        circle.style.transition = 'all 0.3s ease';
        group.appendChild(circle);
        
        // Label text (above)
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('x', nx);
        label.setAttribute('y', y - 10 * scale);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'central');
        label.setAttribute('fill', isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.5)');
        label.setAttribute('font-size', 8 * scale);
        label.setAttribute('font-weight', isActive ? 'bold' : 'normal');
        label.setAttribute('font-family', 'Inter, sans-serif');
        label.textContent = node.label;
        group.appendChild(label);
    });
    
    return group;
}

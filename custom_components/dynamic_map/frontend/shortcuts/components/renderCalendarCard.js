export function renderCalendarCard(svgNS, props, hass) {
    const group = document.createElementNS(svgNS, 'g');
    const x = props.x || 0;
    const y = props.y || 0;
    const width = props.width || 120;
    const height = props.height || 48;
    const scale = props.scale || 1.0;
    
    let eventTitle = 'No events';
    let eventTime = '';
    
    // Get calendar events dynamically if hass entity is configured
    if (props.entity && hass && hass.states[props.entity]) {
        const stateObj = hass.states[props.entity];
        if (stateObj.attributes) {
            if (stateObj.attributes.message) {
                eventTitle = stateObj.attributes.message;
            }
            if (stateObj.attributes.start_time) {
                const start = new Date(stateObj.attributes.start_time);
                if (!isNaN(start.getTime())) {
                    eventTime = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    const end = stateObj.attributes.end_time ? new Date(stateObj.attributes.end_time) : null;
                    if (end && !isNaN(end.getTime())) {
                        eventTime += ' - ' + end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                }
            }
        }
    } else if (props.value) {
        eventTitle = props.value;
    }
    
    // 1. Base Glassmorphic Dashboard Card
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', x - (width / 2) * scale);
    rect.setAttribute('y', y - (height / 2) * scale);
    rect.setAttribute('width', width * scale);
    rect.setAttribute('height', height * scale);
    rect.setAttribute('rx', 8 * scale);
    rect.setAttribute('ry', 8 * scale);
    rect.setAttribute('fill', props.color || 'rgba(15, 23, 42, 0.85)');
    rect.setAttribute('stroke', 'rgba(255, 255, 255, 0.15)');
    rect.setAttribute('stroke-width', '1.5');
    rect.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    group.appendChild(rect);
    
    // 2. Visual Calendar Date Block (Red header with white body)
    const blockG = document.createElementNS(svgNS, 'g');
    const bx = x - (width / 2) * scale + 8 * scale;
    const by = y - (height / 2) * scale + 8 * scale;
    const bw = 32 * scale;
    const bh = 32 * scale;
    
    // Calendar body
    const cBody = document.createElementNS(svgNS, 'rect');
    cBody.setAttribute('x', bx);
    cBody.setAttribute('y', by);
    cBody.setAttribute('width', bw);
    cBody.setAttribute('height', bh);
    cBody.setAttribute('rx', 4 * scale);
    cBody.setAttribute('ry', 4 * scale);
    cBody.setAttribute('fill', '#ffffff');
    blockG.appendChild(cBody);
    
    // Calendar top red bar header
    const cHeader = document.createElementNS(svgNS, 'path');
    const pathData = `
        M ${bx} ${by + 8 * scale} 
        L ${bx} ${by + 4 * scale} 
        A ${4 * scale} ${4 * scale} 0 0 1 ${bx + 4 * scale} ${by} 
        L ${bx + bw - 4 * scale} ${by} 
        A ${4 * scale} ${4 * scale} 0 0 1 ${bx + bw} ${by + 4 * scale} 
        L ${bx + bw} ${by + 8 * scale} Z
    `.trim();
    cHeader.setAttribute('d', pathData);
    cHeader.setAttribute('fill', '#ef4444');
    blockG.appendChild(cHeader);
    
    // Date month text (micro abbreviation, e.g. "MAY")
    const now = new Date();
    const monthStr = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const dayStr = now.toLocaleDateString('en-US', { day: 'numeric' });
    
    const monthText = document.createElementNS(svgNS, 'text');
    monthText.setAttribute('x', bx + bw / 2);
    monthText.setAttribute('y', by + 5 * scale);
    monthText.setAttribute('text-anchor', 'middle');
    monthText.setAttribute('dominant-baseline', 'central');
    monthText.setAttribute('fill', '#ffffff');
    monthText.setAttribute('font-size', 6 * scale);
    monthText.setAttribute('font-weight', 'bold');
    monthText.setAttribute('font-family', 'Inter, sans-serif');
    monthText.textContent = monthStr;
    blockG.appendChild(monthText);
    
    // Date day text (big day number, e.g. "31")
    const dayText = document.createElementNS(svgNS, 'text');
    dayText.setAttribute('x', bx + bw / 2);
    dayText.setAttribute('y', by + bh / 2 + 5 * scale);
    dayText.setAttribute('text-anchor', 'middle');
    dayText.setAttribute('dominant-baseline', 'central');
    dayText.setAttribute('fill', '#1e293b');
    dayText.setAttribute('font-size', 14 * scale);
    dayText.setAttribute('font-weight', 'bold');
    dayText.setAttribute('font-family', 'Outfit, Inter, sans-serif');
    dayText.textContent = dayStr;
    blockG.appendChild(dayText);
    
    group.appendChild(blockG);
    
    // 3. Event Details (Title and Time layout block on the right)
    const tx = bx + bw + 8 * scale;
    const ty = y - 4 * scale;
    
    const eventText = document.createElementNS(svgNS, 'text');
    eventText.setAttribute('x', tx);
    eventText.setAttribute('y', ty);
    eventText.setAttribute('text-anchor', 'start');
    eventText.setAttribute('dominant-baseline', 'central');
    eventText.setAttribute('fill', '#ffffff');
    eventText.setAttribute('font-size', 11 * scale);
    eventText.setAttribute('font-weight', 'bold');
    eventText.setAttribute('font-family', 'Inter, sans-serif');
    
    // Truncate eventTitle if too long
    let titleDisp = eventTitle;
    if (titleDisp.length > 14) {
        titleDisp = titleDisp.slice(0, 12) + '...';
    }
    eventText.textContent = titleDisp;
    group.appendChild(eventText);
    
    if (eventTime) {
        const timeText = document.createElementNS(svgNS, 'text');
        timeText.setAttribute('x', tx);
        timeText.setAttribute('y', y + 10 * scale);
        timeText.setAttribute('text-anchor', 'start');
        timeText.setAttribute('dominant-baseline', 'central');
        timeText.setAttribute('fill', 'rgba(255, 255, 255, 0.6)');
        timeText.setAttribute('font-size', 9 * scale);
        timeText.setAttribute('font-weight', 'normal');
        timeText.setAttribute('font-family', 'Inter, sans-serif');
        timeText.textContent = eventTime;
        group.appendChild(timeText);
    }
    
    return group;
}

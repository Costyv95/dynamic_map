export function renderAlarmClock(svgNS, props, hass) {
    const group = document.createElementNS(svgNS, 'g');
    const x = props.x || 0;
    const y = props.y || 0;
    const width = props.width || 64;
    const height = props.height || 26;
    const scale = props.scale || 1.0;
    
    let alarmState = 'off';
    let alarmTime = '--:--';
    
    if (props.entity && hass && hass.states[props.entity]) {
        const stateObj = hass.states[props.entity];
        alarmState = stateObj.state; // 'on', 'off', 'active', 'triggered'
        
        if (stateObj.attributes && stateObj.attributes.next_alarm) {
            const dt = new Date(stateObj.attributes.next_alarm);
            if (!isNaN(dt.getTime())) {
                alarmTime = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            }
        } else if (stateObj.attributes && stateObj.attributes.time) {
            alarmTime = stateObj.attributes.time;
        } else if (props.value) {
            alarmTime = props.value;
        }
    } else if (props.value) {
        alarmTime = props.value;
    }
    
    const isActive = alarmState === 'on' || alarmState === 'active' || alarmState === 'triggered';
    const isTriggered = alarmState === 'triggered';
    
    // Glassmorphic background card
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', x - (width / 2) * scale);
    rect.setAttribute('y', y - (height / 2) * scale);
    rect.setAttribute('width', width * scale);
    rect.setAttribute('height', height * scale);
    rect.setAttribute('rx', 6 * scale);
    rect.setAttribute('ry', 6 * scale);
    
    // Premium color options based on alarm state
    let bgFill = props.color || 'rgba(30, 41, 59, 0.75)';
    let strokeColor = 'rgba(255, 255, 255, 0.15)';
    
    if (isActive) {
        bgFill = props.active_color || 'rgba(239, 68, 68, 0.85)';
        strokeColor = 'rgba(255, 255, 255, 0.4)';
    }
    if (isTriggered) {
        bgFill = 'rgba(220, 38, 38, 0.95)';
    }
    
    rect.setAttribute('fill', bgFill);
    rect.setAttribute('stroke', strokeColor);
    rect.setAttribute('stroke-width', '1.5');
    rect.style.transition = 'all 0.3s ease';
    
    if (isTriggered) {
        rect.style.animation = 'alarm-pulse 1s infinite alternate';
    }
    group.appendChild(rect);
    
    // Icon wrapper (bell)
    const iconObj = document.createElementNS(svgNS, 'foreignObject');
    iconObj.setAttribute('x', x - (width / 2) * scale + 6 * scale);
    iconObj.setAttribute('y', y - 8 * scale);
    iconObj.setAttribute('width', 16 * scale);
    iconObj.setAttribute('height', 16 * scale);
    
    const icon = document.createElement('ha-icon');
    icon.setAttribute('icon', isTriggered ? 'mdi:bell-ring' : (isActive ? 'mdi:bell' : 'mdi:bell-off-outline'));
    icon.style.color = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
    icon.style.setProperty('--mdc-icon-size', `${16 * scale}px`);
    icon.style.display = 'block';
    
    if (isTriggered) {
        icon.style.animation = 'alarm-shake 0.3s infinite';
    }
    iconObj.appendChild(icon);
    group.appendChild(iconObj);
    
    // Time text
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', x + 8 * scale);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)');
    text.setAttribute('font-size', 11 * scale);
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-family', 'Inter, Roboto, sans-serif');
    text.textContent = alarmTime;
    group.appendChild(text);
    
    // Inject CSS keyframes for gorgeous visual vibrations and glowing effects
    if (typeof document !== 'undefined' && !document.getElementById('alarm-clock-animations')) {
        const style = document.createElement('style');
        style.id = 'alarm-clock-animations';
        style.textContent = `
            @keyframes alarm-pulse {
                0% { filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.4)) saturate(1.2); }
                100% { filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.95)) saturate(1.5); }
            }
            @keyframes alarm-shake {
                0% { transform: rotate(0deg); }
                20% { transform: rotate(12deg); }
                40% { transform: rotate(-12deg); }
                60% { transform: rotate(8deg); }
                80% { transform: rotate(-8deg); }
                100% { transform: rotate(0deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    return group;
}

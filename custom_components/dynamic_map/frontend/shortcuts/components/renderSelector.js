export function renderSelector(svgNS, props, hass) {
    const group = document.createElementNS(svgNS, 'g');
    
    // Renders the visual outline highlights for the room selector
    // and binds interactivity with the visual selector tool
    if (props.room_mapping) {
        Object.entries(props.room_mapping).forEach(([roomName, roomId]) => {
            const roomEl = document.getElementById(roomId);
            if (roomEl) {
                // We add visual outlines or highlights that light up when selected
                const clone = roomEl.cloneNode(true);
                clone.setAttribute('fill', 'rgba(14, 165, 233, 0.15)');
                clone.setAttribute('stroke', '#0ea5e9');
                clone.setAttribute('stroke-width', 1.5);
                clone.style.pointerEvents = 'all';
                clone.style.cursor = 'pointer';
                clone.style.opacity = '0';
                clone.style.transition = 'opacity 0.2s ease';
                clone.classList.add('vacuum-room-highlight');
                clone.setAttribute('data-room-name', roomName);
                
                clone.addEventListener('mouseenter', () => {
                    clone.style.opacity = '0.7';
                });
                clone.addEventListener('mouseleave', () => {
                    if (clone.getAttribute('data-selected') !== 'true') {
                        clone.style.opacity = '0';
                    }
                });
                
                group.appendChild(clone);
            }
        });
    }
    
    return group;
}

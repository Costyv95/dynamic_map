import { areaScenes } from './RoomEntities.js?v=3.2.1';

/** Chip row of the area's scenes and scripts; tapping activates one. */
export function scenesBar(host, hass, room) {
    const ids = room.area_id ? areaScenes(hass, room.area_id) : [];
    if (!ids.length) return null;
    const bar = document.createElement('div');
    bar.className = 'dm-rp-scenes';
    ids.forEach(id => {
        const st = hass.states[id];
        const chip = document.createElement('button');
        chip.className = 'dm-rp-scene';
        chip.type = 'button';
        chip.textContent = `${id.startsWith('script.') ? '▶ ' : '✨ '}${(st.attributes && st.attributes.friendly_name) || id.split('.')[1].replace(/_/g, ' ')}`;
        chip.title = id;
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!host._hass) return;
            host._hass.callService(id.split('.')[0], 'turn_on', { entity_id: id });
            chip.classList.add('dm-fired');
            setTimeout(() => chip.classList.remove('dm-fired'), 600);
        });
        bar.appendChild(chip);
    });
    return bar;
}

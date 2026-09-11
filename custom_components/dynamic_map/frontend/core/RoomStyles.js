import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.1';

/**
 * Room polygon styling: base colour (or golden-angle auto hue), "on"
 * glow, focus dimming, and the vacuum room-selection look. Works on any
 * scene host with `mapRoot`, `rooms`, `_hass`, `focusedRoomId`,
 * `isSelectingRooms`, `selectedRoomIds` and (editor) `selectedRoomIds`.
 */

/** Colour helpers for one room: solid rgb and a fill at alpha. */
export function roomPalette(room, idx) {
    const hue = (idx * 137.5) % 360;
    const rgb = MapGeometry.hexToRgb(room.color);
    const base = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : null;
    return {
        solid: base ? `rgb(${base})` : `hsl(${hue}, 100%, 50%)`,
        fillAt: (a) => base ? `rgba(${base}, ${a})` : `hsla(${hue}, 100%, 50%, ${a})`
    };
}

export function roomIsOn(room, hass) {
    if (!room.entity_id || !hass || !hass.states) return false;
    const st = hass.states[room.entity_id];
    return !!st && st.state === 'on';
}

export function updateRoomStyles(host) {
    if (!host.mapRoot) return;
    const anyFocus = !!host.focusedRoomId && !host.isSelectingRooms;
    const polygons = host.mapRoot.querySelectorAll('polygon.room-polygon');
    polygons.forEach((poly, idx) => {
        const room = host.rooms[idx];
        if (!room) return;
        const isFocused = (host.focusedRoomId === room.id);
        const { solid, fillAt } = roomPalette(room, idx);
        const isOn = roomIsOn(room, host._hass);

        poly.classList.remove('dm-selected', 'dm-on');
        poly.classList.toggle('dm-dimmed', anyFocus && !isFocused);
        poly.style.removeProperty('--dm-room-glow');

        if (host.isSelectingRooms) {
            if (host.selectedRoomIds && host.selectedRoomIds.includes(room.id)) {
                poly.setAttribute('fill', fillAt(0.8));
                poly.setAttribute('stroke', '#10b981');
                poly.style.setProperty('--dm-room-glow', '#10b981');
                poly.classList.add('dm-on');
            } else {
                poly.setAttribute('fill', 'rgba(0,0,0,0.4)');
                poly.setAttribute('stroke', 'rgba(255,255,255,0.2)');
            }
            return;
        }
        if (isFocused) {
            // Nearly clear: the zoomed-in room should show the floorplan and
            // its shortcuts, not a coloured veil.
            poly.setAttribute('fill', fillAt(0.08));
            poly.setAttribute('stroke', 'var(--dm-accent)');
            poly.classList.add('dm-selected');
        } else if (isOn) {
            poly.setAttribute('fill', fillAt(0.5));
            poly.setAttribute('stroke', solid);
            poly.style.setProperty('--dm-room-glow', solid);
            poly.classList.add('dm-on');
        } else {
            poly.setAttribute('fill', fillAt(0.18));
            poly.setAttribute('stroke', fillAt(0.7));
        }
    });
    // Dim other rooms' labels while one room has focus.
    host.mapRoot.querySelectorAll('.room-label').forEach(label => {
        label.classList.toggle('dm-dimmed', anyFocus && label.dataset.roomId !== String(host.focusedRoomId));
    });
}

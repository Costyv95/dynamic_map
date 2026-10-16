import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.1';

/**
 * Room polygon styling: base colour (or golden-angle auto hue), "on"
 * glow, focus dimming, and the vacuum room-selection look. Works on any
 * scene host with `mapRoot`, `rooms`, `_hass`, `focusedRoomId`,
 * `isSelectingRooms`, `selectedRoomIds` and (editor) `selectedRoomIds`.
 */

/** Colour helpers for one room: solid rgb and a fill at alpha. */
export function roomPalette(room, idx) {
    const rgb = MapGeometry.hexToRgb(room.color);
    // A room without a colour is plain floor: the walls already tell rooms
    // apart, so it shows no tint at rest and warm light when it is on.
    const base = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '245, 176, 65';
    return {
        solid: `rgb(${base})`,
        neutral: !rgb,
        fillAt: (a) => `rgba(${base}, ${a})`
    };
}

/** Palette for an rgb(r, g, b) tint (temperature colouring). */
export function tintPalette(rgb) {
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgb);
    const base = m ? `${m[1]}, ${m[2]}, ${m[3]}` : '100, 116, 139';
    return { solid: `rgb(${base})`, fillAt: (a) => `rgba(${base}, ${Math.min(1, a * 1.8)})` };
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
        const tint = typeof host.roomTint === 'function' ? host.roomTint(room) : null;
        const { solid, fillAt, neutral } = tint ? tintPalette(tint) : roomPalette(room, idx);
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
            poly.setAttribute('fill', fillAt(neutral ? 0.24 : 0.36));
            poly.setAttribute('stroke', 'none');
            poly.style.setProperty('--dm-room-glow', solid);
            poly.classList.add('dm-on');
        } else {
            // At rest a soft wash of the room's colour; the walls draw the edges.
            poly.setAttribute('fill', neutral ? 'rgba(0, 0, 0, 0)' : fillAt(0.12));
            poly.setAttribute('stroke', 'none');
        }
    });
    // Dim other rooms' labels while one room has focus.
    host.mapRoot.querySelectorAll('.room-label').forEach(label => {
        label.classList.toggle('dm-dimmed', anyFocus && label.dataset.roomId !== String(host.focusedRoomId));
    });
}

import { roomViewBox } from '../core/Viewport.js?v=3.2.1';
import { showRoomPanel, hideRoomPanel } from './RoomPanel.js?v=3.2.1';

/**
 * Room tap behaviour and the zoom camera: `room_tap_action` / per-room
 * `tap_action` = 'zoom' | 'toggle' | 'area_toggle' | 'more-info' | 'none'.
 * Default 'zoom' animates the viewBox into the room so its shortcuts are
 * easy to tap; tapping again, the name pill, or the background zooms out.
 * `host` is the card.
 */

export const ZOOM_ANIMATION_MS = 320;

export function buildFocusPill(host) {
    host.focusPill = document.createElement('button');
    host.focusPill.className = 'dm-focus-pill';
    host.focusPill.innerHTML = `<span class="dm-pill-label"></span><span class="dm-pill-x">✕</span>`;
    host.focusPill.addEventListener('click', (e) => {
        e.stopPropagation();
        host.zoomOutToDefault();
    });
    host.renderRoot.appendChild(host.focusPill);
}

export function syncFocusPill(host) {
    if (!host.focusPill) return;
    const room = host.rooms.find(r => r.id === host.focusedRoomId);
    if (room) {
        host.focusPill.querySelector('.dm-pill-label').textContent = room.name || 'Room';
        host.focusPill.classList.add('dm-visible');
    } else {
        host.focusPill.classList.remove('dm-visible');
    }
}

export function onRoomTap(host, room) {
    // Multi-select mode (e.g. picking rooms for vacuum cleaning)
    if (host.isSelectingRooms) {
        if (host.selectedRoomIds.includes(room.id)) {
            host.selectedRoomIds = host.selectedRoomIds.filter(id => id !== room.id);
        } else {
            host.selectedRoomIds.push(room.id);
        }
        host.updateRoomStyles();
        return;
    }
    const action = room.tap_action || host.config.room_tap_action || 'zoom';
    switch (action) {
        case 'none':
            return;
        case 'more-info':
            if (room.entity_id && host._hass) {
                host.dispatchEvent(new CustomEvent('hass-more-info', {
                    detail: { entityId: room.entity_id }, bubbles: true, composed: true
                }));
            }
            return;
        case 'area_toggle':
            if (room.area_id && host._hass) {
                host._hass.callService('light', 'toggle', {}, { area_id: room.area_id });
            }
            return;
        case 'toggle':
            if (!host._hass) return;
            host.focusedRoomId = (host.focusedRoomId === room.id) ? null : room.id;
            host.updateRoomStyles();
            if (room.entity_id) {
                host._hass.callService(room.entity_id.split('.')[0], 'toggle', { entity_id: room.entity_id });
            } else if (room.area_id) {
                host._hass.callService('light', 'toggle', {}, { area_id: room.area_id });
            }
            return;
        case 'zoom':
        default:
            if (host.focusedRoomId === room.id) {
                host.zoomOutToDefault();
            } else {
                host.focusedRoomId = room.id;
                host.zoomToRoom(room);
                host.updateRoomStyles();
                host.syncFocusPill();
                showRoomPanel(host, room);
            }
    }
}

/** Animate the camera into a room's bounding box. */
export function zoomToRoom(host, room) {
    const rect = host.getBoundingClientRect();
    const ratio = (rect.width > 0 ? rect.width : 1) / (rect.height > 0 ? rect.height : 1);
    // Respect the same minimum zoom window as manual pinch/wheel zoom.
    host._zoomTargetVb = roomViewBox({
        mapPoint: (x, y) => host.mapPointToView(x, y), room,
        imgW: host.imgW, imgH: host.imgH, screenRatio: ratio, minW: host.imgW * 0.05
    });
    host.animateViewBox(host._zoomTargetVb);
}

export function zoomOutToDefault(host) {
    host.focusedRoomId = null;
    host._zoomTargetVb = null;
    hideRoomPanel(host);
    if (host.defaultVb) host.animateViewBox({ ...host.defaultVb });
    host.updateRoomStyles();
    host.syncFocusPill();
}

/** Smoothly interpolate the SVG viewBox to a target rectangle. */
export function animateViewBox(host, target, duration = ZOOM_ANIMATION_MS) {
    if (host._vbAnimFrame) cancelAnimationFrame(host._vbAnimFrame);
    if (typeof requestAnimationFrame !== 'function') {
        host.vb = { ...target };
        host.updateViewBox();
        return;
    }
    const from = { ...host.vb };
    const start = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const k = ease(t);
        host.vb = {
            x: from.x + (target.x - from.x) * k,
            y: from.y + (target.y - from.y) * k,
            w: from.w + (target.w - from.w) * k,
            h: from.h + (target.h - from.h) * k
        };
        host.updateViewBox();
        host._vbAnimFrame = (t < 1) ? requestAnimationFrame(step) : null;
    };
    host._vbAnimFrame = requestAnimationFrame(step);
}

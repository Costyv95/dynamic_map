import { roomViewBox } from '../core/Viewport.js?v=3.2.1';
import { showRoomPanel, hideRoomPanel } from './RoomPanel.js?v=3.2.1';

/**
 * Room tap behaviour and the zoom camera: `room_tap_action` / per-room
 * `tap_action` = 'zoom' | 'toggle' | 'area_toggle' | 'more-info' | 'none'.
 * Default 'zoom' animates the viewBox into the room so its shortcuts are
 * easy to tap; tapping again, the name pill, or the background zooms out.
 * `host` is the card.
 */

export const ZOOM_ANIMATION_MS = 420;   // a touch longer reads as smooth now that frames are free

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
/** Share of the card the room sheet covers on a phone (0 on wide cards or with the panel off). */
export function sheetFraction(host) {
    return host.isNarrow && !(host.config && host.config.room_panel === false) ? SHEET_FRACTION : 0;
}
const SHEET_FRACTION = 0.38;

export function zoomToRoom(host, room) {
    const rect = host.getBoundingClientRect();
    const sheet = sheetFraction(host);
    // On a phone the room must fit the part of the card above the bottom sheet.
    const ratio = (rect.width > 0 ? rect.width : 1) / ((rect.height > 0 ? rect.height : 1) * (1 - sheet));
    // Respect the same minimum zoom window as manual pinch/wheel zoom.
    const vb = roomViewBox({
        mapPoint: (x, y) => host.mapPointToView(x, y), room,
        imgW: host.imgW, imgH: host.imgH, screenRatio: ratio, minW: host.imgW * 0.05
    });
    vb.h = vb.h / (1 - sheet);   // extend downwards: the sheet covers the extra strip
    host._zoomTargetVb = vb;
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
const EASE = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const EASE_CSS = 'cubic-bezier(0.65, 0, 0.35, 1)';

/** The viewBox the running zoom is currently showing (interpolated), or host.vb. */
function currentVb(host) {
    const a = host._vbAnim;
    if (!a) return { ...host.vb };
    const t = Math.max(0, Math.min(1, (performance.now() - a.start) / a.duration));
    const k = EASE(t);
    return { x: a.from.x + (a.to.x - a.from.x) * k, y: a.from.y + (a.to.y - a.from.y) * k, w: a.from.w + (a.to.w - a.from.w) * k, h: a.from.h + (a.to.h - a.from.h) * k };
}

/** Stop a running zoom where it is: commit the interpolated viewBox and drop the transform. */
export function settleViewBox(host) {
    if (!host._vbAnim) return;
    const vb = currentVb(host);
    host._vbAnim.anim.cancel();
    host._vbAnim = null;
    host.svg.style.transform = '';
    host.svg.style.willChange = '';
    host.vb = vb;
    host.updateViewBox();
}

/**
 * CSS transform that makes the svg (currently showing `from`) look like it
 * shows `to`: scale about the top-left, then shift so `to`'s origin lands
 * where `from`'s origin was (same aspect for both, as all zoom targets are).
 */
export function zoomTransform(from, to, rect) {
    const ppu = Math.min(rect.width / from.w, rect.height / from.h);
    const ox = (rect.width - from.w * ppu) / 2, oy = (rect.height - from.h * ppu) / 2;
    const s = Math.min(from.w / to.w, from.h / to.h);
    const X = ox + (to.x - from.x) * ppu, Y = oy + (to.y - from.y) * ppu;
    return `translate(${(ox - X * s).toFixed(2)}px, ${(oy - Y * s).toFixed(2)}px) scale(${s.toFixed(5)})`;
}

/**
 * Zoom the map to `target`. The animation is a compositor transform on the
 * svg (no per-frame re-layout or re-raster of badges and filters); the
 * real viewBox is written once at the end.
 */
export function animateViewBox(host, target, duration = ZOOM_ANIMATION_MS) {
    if (host._vbAnimFrame) { cancelAnimationFrame(host._vbAnimFrame); host._vbAnimFrame = null; }
    const svg = host.svg;
    const canComposite = svg && typeof svg.animate === 'function' && typeof requestAnimationFrame === 'function';
    if (!canComposite) { animateViewBoxByFrames(host, target, duration); return; }
    const from = currentVb(host);
    if (host._vbAnim) { host._vbAnim.anim.cancel(); host._vbAnim = null; }
    // Draw `from` for real, then let the compositor carry the motion.
    host.vb = from;
    host.updateViewBox();
    const rect = svg.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) { host.vb = { ...target }; host.updateViewBox(); return; }
    svg.style.transformOrigin = '0 0';
    svg.style.willChange = 'transform';
    const anim = svg.animate([{ transform: 'none' }, { transform: zoomTransform(from, target, rect) }], { duration, easing: EASE_CSS, fill: 'forwards' });
    const entry = { anim, from, to: { ...target }, start: performance.now(), duration };
    host._vbAnim = entry;
    anim.onfinish = () => {
        if (host._vbAnim !== entry) return;
        host._vbAnim = null;
        host.vb = { ...target };
        host.updateViewBox();
        anim.cancel();
        svg.style.transform = '';
        svg.style.willChange = '';
    };
}

/** Fallback without the Web Animations API: interpolate the viewBox per frame. */
function animateViewBoxByFrames(host, target, duration) {
    if (typeof requestAnimationFrame !== 'function') {
        host.vb = { ...target };
        host.updateViewBox();
        return;
    }
    const from = { ...host.vb };
    const start = performance.now();
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const k = EASE(t);
        host.vb = { x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, w: from.w + (target.w - from.w) * k, h: from.h + (target.h - from.h) * k };
        host.updateViewBox();
        host._vbAnimFrame = (t < 1) ? requestAnimationFrame(step) : null;
    };
    host._vbAnimFrame = requestAnimationFrame(step);
}

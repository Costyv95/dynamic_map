import { computeViewport } from '../core/Viewport.js?v=3.2.1';
import { applyViewport } from '../core/MapScene.js?v=3.2.1';
import { hideRoomPanel } from './RoomPanel.js?v=3.2.1';
import { updateRoomAlerts } from './RoomAlerts.js?v=3.2.1';

/** Fit the rooms into the card (rotation, flips, viewBox) and re-layout what depends on it. */
export function applyAutoCrop(host) {
    host.focusedRoomId = null;
    host.syncFocusPill();
    hideRoomPanel(host);
    const rect = host.getBoundingClientRect();
    // Phone-sized cards get bottom sheets instead of side panels.
    host.isNarrow = rect.width > 0 && rect.width < 600;
    if (host.renderRoot) host.renderRoot.classList.toggle('dm-narrow', host.isNarrow);
    const vp = computeViewport({
        rooms: host.rooms, imgW: host.imgW, imgH: host.imgH,
        screenW: rect.width, screenH: rect.height,
        rotationMode: host.rotationMode, flips: host.flips
    });
    host.viewport = vp;
    host.isRotated = vp.isRotated;
    host.activeMode = vp.activeMode;
    host.mapScaleX = vp.scaleX;
    host.mapScaleY = vp.scaleY;
    host.transformCenter = { cx: vp.cx, cy: vp.cy };
    if (host.rooms.length) applyViewport(host, vp);
    host.vb = { ...vp.vb };
    host.defaultVb = { ...vp.vb };
    host.updateViewBox();
    // Shortcut layouts resolve per-orientation props at render time:
    // when the mode flips, rebuild them now instead of waiting for the
    // next hass tick.
    if (host._lastAppliedMode !== host.activeMode && host.shortcutElements && host._hass) {
        for (const id in host.shortcutElements) host.shortcutElements[id].updateState(host._hass);
        host.applyShortcutTransforms(host.isRotated ? vp.scaleX : 1, host.isRotated ? vp.scaleY : 1);
    }
    host._lastAppliedMode = host.activeMode;
    if (host._hass) updateRoomAlerts(host, host._hass);   // badge size follows the on-screen scale
}

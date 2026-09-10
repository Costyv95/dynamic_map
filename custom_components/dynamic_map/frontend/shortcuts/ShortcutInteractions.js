import { executeAction } from '../shared/ActionRunner.js?v=3.2.1';

/**
 * Tap / long-press handling for an interactive badge. Functions take the
 * MapShortcut instance as `host`. Pointer Events cover mouse and touch.
 */

export const LONG_PRESS_MS = 500;
const DRAG_SLOP_PX = 8;

export function setupInteractions(host) {
    host.group.style.cursor = 'pointer';
    let pressTimer = null;
    let isDragging = false;
    let startPos = null;

    host.group.addEventListener('pointerdown', (e) => {
        isDragging = false;
        startPos = { x: e.clientX, y: e.clientY };
        pressTimer = window.setTimeout(() => {
            pressTimer = null;
            host.onLongPress(e);
        }, LONG_PRESS_MS);
    });

    host.group.addEventListener('pointermove', (e) => {
        if (!startPos) return;
        const dist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y);
        if (dist > DRAG_SLOP_PX) {
            isDragging = true;
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        }
    });

    host.group.addEventListener('pointerup', (e) => {
        startPos = null;
        if (pressTimer) {
            clearTimeout(pressTimer);
            if (!isDragging) host.onClick(e);
        }
        e.stopPropagation();
    });

    host.group.addEventListener('pointercancel', () => {
        startPos = null;
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    });
}

export function onClick(host) {
    const actions = host.config.actions || [];
    const tapActions = actions.filter(a => a.trigger === 'tap');
    if (tapActions.length > 0) {
        tapActions.forEach(act => {
            const target = act.action_entity || host.sc.entity_id;
            // Tap actions intentionally skip room-name -> segment-ID
            // replacement and error alerts (see ActionRunner divergence notes).
            executeAction(host.mapContext._hass, act, target);
        });
        return;
    }
    // Sensors without an explicit tap action: tapping cycles the pill
    // between its configured readings (temperature <-> humidity/moisture).
    if (host.sc.type === 'sensor') cycleSensorDisplay(host);
}

export function cycleSensorDisplay(host) {
    const cfg = host.config || {};
    const options = [null];
    if (cfg.humidity_entity) options.push({ entity: cfg.humidity_entity, unit: '%', icon: '💧' });
    if (options.length < 2) return;
    host._displayIdx = ((host._displayIdx || 0) + 1) % options.length;
    host.displayOverride = options[host._displayIdx];
    if (host.mapContext && host.mapContext._hass) host.updateState(host.mapContext._hass);
}

export function onLongPress(host, e) {
    if (!host.config.actions) return;
    const overlayActions = host.config.actions.filter(a => a.trigger === 'overlay' || a.trigger === 'long_press');
    if (overlayActions.length > 0 && host.mapContext.showOverlay) {
        host.mapContext.showOverlay(host, overlayActions, e);
    } else if (host.sc.entity_id && host.mapContext._hass) {
        const event = new Event('hass-more-info', { bubbles: true, composed: true });
        event.detail = { entityId: host.sc.entity_id };
        host.mapContext.dispatchEvent(event);
    }
}

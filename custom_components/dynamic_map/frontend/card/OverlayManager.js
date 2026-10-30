import { clampAndPositionOverlay } from './overlay/common.js?v=3.2.1';
import { buildColorHoneycomb } from './overlay/colorHoneycomb.js?v=3.2.1';
import { showSensorDials } from './overlay/sensorDials.js?v=3.2.1';
import { buildSlider, buildValueSlider, buildWarmthSlider } from './overlay/sliders.js?v=3.2.1';
import { buildInfoDisplay, buildProgressBar } from './overlay/infoItems.js?v=3.2.1';
import { buildToggle, buildButton } from './overlay/buttons.js?v=3.2.1';
import { showRoomSelectionUI } from './overlay/roomSelection.js?v=3.2.1';

/**
 * Long-press action menus. Each action type has a builder in overlay/*;
 * this module places the menu near the pointer and closes it on an
 * outside tap. `mapContext` is the card.
 */
const BUILDERS = {
    SLIDER: buildSlider,
    VALUE_SLIDER: buildValueSlider,
    WARMTH: buildWarmthSlider,
    INFO_DISPLAY: buildInfoDisplay,
    PROGRESS_BAR: buildProgressBar,
    COLOR_PICKER: buildColorHoneycomb,
    TOGGLE: buildToggle,
    TOGGLE_ON: buildButton,
    TOGGLE_OFF: buildButton,
    CALL_SERVICE: buildButton,
    ROOM_SELECTOR: buildButton,
    VACUUM_SCHEDULES: buildButton,
    VACUUM_ROOMS: (ctx, target, act, v) => buildButton(ctx, target, { ...act, type: 'ROOM_SELECTOR' }, v)   // the old preset's name (#1743)
};

/** Menu size for a designed layout: the saved size, or larger if items stick out. */
export function visualMenuBox(cfg, actions) {
    let w = Number(cfg.menuWidth) || 200, h = Number(cfg.menuHeight) || 250;
    (actions || []).forEach(a => {
        if (a.pos_x === undefined) return;
        w = Math.max(w, (a.pos_x || 0) + (parseFloat(a.width) || 180) + 8);
        h = Math.max(h, (a.pos_y || 0) + (parseFloat(a.height) || 35) + 8);
    });
    return { w, h };
}

// One outside-tap listener per card, added at once: a 50 ms timer outlived quick
// closes (and jsdom in tests), and earlier menus' listeners were never removed.
function closeOnOutsideTap(mapContext) {
    if (mapContext._outsideTap) document.removeEventListener('pointerdown', mapContext._outsideTap);
    const openedAt = performance.now();
    const listener = (e) => {
        if (performance.now() - openedAt < 50) return; // the press that opened it
        const ov = mapContext.activeOverlay;
        if (ov && ov.contains(e.composedPath()[0])) return;
        if (ov) ov.remove();
        mapContext.activeOverlay = null;
        mapContext._outsideTap = null;
        document.removeEventListener('pointerdown', listener);
    };
    mapContext._outsideTap = listener;
    document.addEventListener('pointerdown', listener);
}

export class OverlayManager {
    static buildColorHoneycomb(mapContext, target, act) {
        return buildColorHoneycomb(mapContext, target, act);
    }

    static showActionMenu(mapContext, shortcut, actions, event) {
        if (mapContext.activeOverlay) mapContext.activeOverlay.remove();
        closeOnOutsideTap(mapContext);
        const overlay = document.createElement('div');
        overlay.className = 'dm-overlay';
        overlay.style.position = 'absolute';
        mapContext.activeOverlay = overlay;

        const isSensor = (shortcut.sc && shortcut.sc.type === 'sensor') || (actions && actions.some(a => a.type === 'SENSOR_OVERLAY'));
        if (isSensor) {
            showSensorDials(mapContext, shortcut, event);
            return;
        }

        const rect = mapContext.renderRoot.getBoundingClientRect();
        const posX = event.clientX - rect.left;
        const posY = event.clientY - rect.top;
        overlay.style.cssText += `left: ${posX}px; top: ${posY}px; transform: translate(-50%, -100%) translateY(-20px);`;
        const isVisual = !!(shortcut.sc && shortcut.sc.config && shortcut.sc.config.menuWidth);
        // Narrow cards dock the menu to the bottom edge (TouchStyles), so a thumb reaches it.
        if (mapContext.isNarrow) overlay.classList.add('dm-sheet');
        if (isVisual) overlay.classList.add('dm-visual');
        if (isVisual) {
            // Grow to hold every placed item so nothing gets clipped.
            const box = visualMenuBox(shortcut.sc.config, actions);
            overlay.style.width = box.w + 'px';
            overlay.style.height = box.h + 'px';
            overlay.style.cssText += 'display: block; padding: 0; overflow: hidden;';
        } else {
            overlay.style.cssText += 'padding: 10px; display: flex; flex-direction: column; gap: 10px; max-width: min(340px, 92vw);';
        }
        actions.forEach(act => {
            const build = BUILDERS[act.type];
            if (!build) return;
            const target = act.action_entity || shortcut.sc.entity_id;
            overlay.appendChild(build(mapContext, target, act, isVisual));
        });
        mapContext.renderRoot.appendChild(overlay);
        if (!mapContext.isNarrow) clampAndPositionOverlay(overlay, rect, posX, posY);
    }

    static showRoomSelectionUI(mapContext) {
        showRoomSelectionUI(mapContext);
    }
}

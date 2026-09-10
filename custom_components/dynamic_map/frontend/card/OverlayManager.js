import { clampAndPositionOverlay } from './overlay/common.js?v=3.2.1';
import { buildColorHoneycomb } from './overlay/colorHoneycomb.js?v=3.2.1';
import { showSensorDials } from './overlay/sensorDials.js?v=3.2.1';
import { buildSlider, buildValueSlider } from './overlay/sliders.js?v=3.2.1';
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
    INFO_DISPLAY: buildInfoDisplay,
    PROGRESS_BAR: buildProgressBar,
    COLOR_PICKER: buildColorHoneycomb,
    TOGGLE: buildToggle,
    TOGGLE_ON: buildButton,
    TOGGLE_OFF: buildButton,
    CALL_SERVICE: buildButton,
    ROOM_SELECTOR: buildButton
};

function closeOnOutsideTap(mapContext) {
    const listener = (e) => {
        if (mapContext.activeOverlay && !mapContext.activeOverlay.contains(e.composedPath()[0])) {
            mapContext.activeOverlay.remove();
            mapContext.activeOverlay = null;
            document.removeEventListener('pointerdown', listener);
        }
    };
    setTimeout(() => document.addEventListener('pointerdown', listener), 50);
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
        overlay.style.cssText += `left: ${posX}px; top: ${posY}px; transform: translate(-50%, -100%) translateY(-20px);`
            + 'background: rgba(30, 41, 59, 0.9); backdrop-filter: blur(10px); border-radius: 12px;'
            + 'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); z-index: 1000; color: #fff;';
        const isVisual = !!(shortcut.sc && shortcut.sc.config && shortcut.sc.config.menuWidth);
        if (isVisual) {
            overlay.style.width = shortcut.sc.config.menuWidth + 'px';
            overlay.style.height = shortcut.sc.config.menuHeight + 'px';
            overlay.style.cssText += 'display: block; padding: 0; overflow: hidden;';
        } else {
            overlay.style.cssText += 'padding: 10px; display: flex; flex-direction: column; gap: 10px;';
        }
        actions.forEach(act => {
            const build = BUILDERS[act.type];
            if (!build) return;
            const target = act.action_entity || shortcut.sc.entity_id;
            overlay.appendChild(build(mapContext, target, act, isVisual));
        });
        mapContext.renderRoot.appendChild(overlay);
        clampAndPositionOverlay(overlay, rect, posX, posY);
    }

    static showRoomSelectionUI(mapContext) {
        showRoomSelectionUI(mapContext);
    }
}

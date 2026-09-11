import { placeVisual, iconHtml, onServiceError } from './common.js?v=3.2.1';
import { executeAction, buildRoomNameToSegmentMap } from '../../shared/ActionRunner.js?v=3.2.1';
import { showRoomSelectionUI } from './roomSelection.js?v=3.2.1';

/** TOGGLE switch row and the button-style actions. */

export function buildToggle(mapContext, target, act, isVisual) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 15px; padding: 6px 4px;';
    if (act.width) container.style.width = act.width;
    const label = document.createElement('span');
    label.innerHTML = `${iconHtml(act.icon, 18, 'margin-right:8px;')}${act.name !== undefined ? act.name : 'Toggle'}`;
    label.style.fontSize = '13px';
    let isOn = !!(mapContext._hass && mapContext._hass.states[target] && mapContext._hass.states[target].state === 'on');

    const switchWrap = document.createElement('div');
    switchWrap.style.cssText = 'width: 36px; height: 20px; border-radius: 10px; position: relative; cursor: pointer; transition: background 0.2s;';
    const thumb = document.createElement('div');
    thumb.style.cssText = 'width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 2px; transition: left 0.2s;';
    const paint = () => {
        switchWrap.style.background = isOn ? '#10b981' : 'rgba(255,255,255,0.2)';
        thumb.style.left = isOn ? '18px' : '2px';
    };
    paint();
    switchWrap.appendChild(thumb);
    switchWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!mapContext._hass) return;
        executeAction(mapContext._hass, act, target);
        isOn = !isOn; // optimistic update
        paint();
    });
    container.appendChild(label);
    container.appendChild(switchWrap);
    placeVisual(container, act, isVisual);
    return container;
}

const BUTTON_STYLE = {
    TOGGLE_ON: { color: '#10b981', border: 'rgba(16, 185, 129, 0.4)', name: 'Turn On' },
    TOGGLE_OFF: { color: '#ef4444', border: 'rgba(239, 68, 68, 0.4)', name: 'Turn Off' },
    ROOM_SELECTOR: { color: '#0ea5e9', border: 'rgba(14, 165, 233, 0.4)', name: 'Select Rooms' },
    CALL_SERVICE: { color: '#fff', border: 'rgba(255,255,255,0.2)', name: 'Run Action' }
};

export function buildButton(mapContext, target, act, isVisual) {
    const look = BUTTON_STYLE[act.type] || BUTTON_STYLE.CALL_SERVICE;
    const btn = document.createElement('button');
    btn.style.cssText = `background: rgba(255,255,255,0.1); border: 1px solid ${look.border}; border-radius: 6px; padding: 8px;`
        + `color: ${look.color}; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px;`;
    if (act.width) btn.style.width = act.width;
    const displayName = act.name !== undefined ? act.name : look.name;
    btn.innerHTML = `${iconHtml(act.icon, 18)}${displayName ? `<span>${displayName}</span>` : ''}`;
    btn.onmouseenter = () => { btn.style.background = 'rgba(255,255,255,0.2)'; };
    btn.onmouseleave = () => { btn.style.background = 'rgba(255,255,255,0.1)'; };
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!mapContext._hass) return;
        if (!target && act.type !== 'CALL_SERVICE') return;
        if (act.type === 'ROOM_SELECTOR') {
            if (mapContext.activeOverlay) {
                mapContext.activeOverlay.remove();
                mapContext.activeOverlay = null;
            }
            mapContext.isSelectingRooms = true;
            mapContext.selectedRoomIds = [];
            mapContext.selectionVacuumTarget = target;
            mapContext.updateRoomStyles();
            showRoomSelectionUI(mapContext);
            return;
        }
        // Menu buttons apply room-name -> segment-ID replacement and
        // surface CALL_SERVICE errors (see ActionRunner divergence notes).
        executeAction(mapContext._hass, act, target, {
            nameToSegmentId: buildRoomNameToSegmentMap(target, mapContext.shortcutElements, mapContext.rooms),
            onServiceError
        });
    });
    placeVisual(btn, act, isVisual);
    return btn;
}

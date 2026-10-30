import { placeVisual, iconHtml, onServiceError } from './common.js?v=3.2.1';
import { executeAction, buildRoomNameToSegmentMap } from '../../shared/ActionRunner.js?v=3.2.1';
import { showRoomSelectionUI } from './roomSelection.js?v=3.2.1';
import { showSchedulesSheet } from './vacuumSchedules.js?v=3.2.1';

/** TOGGLE switch row and the button-style actions. */

export function buildToggle(mapContext, target, act, isVisual) {
    const container = document.createElement('div');
    container.className = 'dm-ov-toggle';
    if (act.width) container.style.width = act.width;
    const label = document.createElement('span');
    label.innerHTML = `${iconHtml(act.icon, 18, 'margin-right:8px;')}${act.name !== undefined ? act.name : 'Toggle'}`;
    let isOn = !!(mapContext._hass && mapContext._hass.states[target] && mapContext._hass.states[target].state === 'on');

    const switchWrap = document.createElement('div');
    switchWrap.className = 'dm-ov-switch';
    switchWrap.setAttribute('role', 'switch');
    const thumb = document.createElement('div');
    thumb.className = 'dm-ov-thumb';
    const paint = () => {
        switchWrap.classList.toggle('dm-on', isOn);
        switchWrap.setAttribute('aria-checked', String(isOn));
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
    TOGGLE_ON: { cls: 'dm-on-btn', name: 'Turn On' },
    TOGGLE_OFF: { cls: 'dm-off-btn', name: 'Turn Off' },
    ROOM_SELECTOR: { cls: 'dm-rooms-btn', name: 'Select Rooms' },
    VACUUM_SCHEDULES: { cls: 'dm-rooms-btn', name: 'Schedules' },
    CALL_SERVICE: { cls: '', name: 'Run Action' }
};

export function buildButton(mapContext, target, act, isVisual) {
    const look = BUTTON_STYLE[act.type] || BUTTON_STYLE.CALL_SERVICE;
    const btn = document.createElement('button');
    btn.className = `dm-ov-btn ${look.cls}`.trim();
    if (act.width) btn.style.width = act.width;
    const displayName = act.name !== undefined ? act.name : look.name;
    btn.innerHTML = `${iconHtml(act.icon, 18)}${displayName ? `<span>${displayName}</span>` : ''}`;
    btn.title = displayName || '';
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
        if (act.type === 'VACUUM_SCHEDULES') {
            showSchedulesSheet(mapContext, target, act);
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

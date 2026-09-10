/**
 * Vacuum room selection: a bottom sheet while the user taps rooms on the
 * map, then app_segment_clean with the mapped segment ids.
 */

const SELECT_STYLE = 'background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 8px;';

/** Segment ids for the selected SVG rooms via the vacuum's room mapping. */
export function segmentsForRooms(scConfig, selectedRoomIds) {
    const segments = [];
    if (!scConfig || !scConfig.room_mapping) return segments;
    selectedRoomIds.forEach(id => {
        for (const [roboId, svgRoomId] of Object.entries(scConfig.room_mapping)) {
            if (svgRoomId !== id) continue;
            const mapped = (scConfig.segment_mapping && scConfig.segment_mapping[roboId] !== undefined)
                ? scConfig.segment_mapping[roboId] : roboId;
            segments.push(isNaN(mapped) ? mapped : parseInt(mapped));
            break;
        }
    });
    return segments;
}

function applyRoborockMode(hass, target, mode) {
    const call = (d, s, data) => hass.callService(d, s, { entity_id: target, ...data }).catch(() => {});
    if (mode === 'vacuum') {
        call('roborock', 'vacuum_set_mop_mode', { mop_mode: 'off' });
    } else if (mode === 'mop') {
        call('roborock', 'vacuum_set_mop_mode', { mop_mode: 'standard' });
        call('vacuum', 'set_fan_speed', { fan_speed: 'off' });
    } else {
        call('roborock', 'vacuum_set_mop_mode', { mop_mode: 'standard' });
        call('vacuum', 'set_fan_speed', { fan_speed: 'balanced' });
    }
}

export function showRoomSelectionUI(mapContext) {
    if (mapContext.roomSelectionUI) mapContext.roomSelectionUI.remove();
    const ui = document.createElement('div');
    mapContext.roomSelectionUI = ui;
    ui.style.cssText = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.95);'
        + 'border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 12px; padding: 15px; color: #fff; display: flex; flex-direction: column;'
        + 'gap: 15px; backdrop-filter: blur(10px); box-shadow: 0px 10px 30px rgba(0,0,0,0.5); z-index: 1001;';

    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; font-weight: bold; font-size: 14px;';
    header.innerText = 'Select Rooms on Map to Clean';

    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 10px; justify-content: center;';
    const repeats = document.createElement('select');
    repeats.innerHTML = '<option value="1">1x (Default)</option><option value="2">2x (Deep)</option><option value="3">3x (Max)</option>';
    repeats.style.cssText = SELECT_STYLE;
    const mode = document.createElement('select');
    mode.innerHTML = '<option value="vac_mop">Vac & Mop</option><option value="vacuum">Vacuum Only</option><option value="mop">Mop Only</option>';
    mode.style.cssText = SELECT_STYLE;
    controls.appendChild(repeats);
    controls.appendChild(mode);

    const close = () => {
        mapContext.isSelectingRooms = false;
        ui.remove();
        mapContext.updateRoomStyles();
        if (mapContext.selectionInterval) clearInterval(mapContext.selectionInterval);
    };
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; gap: 10px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = 'Cancel';
    cancelBtn.style.cssText = 'flex: 1; padding: 10px; background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer;';
    cancelBtn.onclick = close;
    const startBtn = document.createElement('button');
    startBtn.innerText = 'Start Cleaning (0)';
    startBtn.style.cssText = 'flex: 2; padding: 10px; background: #475569; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;';
    startBtn.onclick = () => {
        if (!mapContext.selectedRoomIds || mapContext.selectedRoomIds.length === 0) return;
        const target = mapContext.selectionVacuumTarget;
        let scConfig = null;
        Object.values(mapContext.shortcutElements).forEach(el => {
            if (el.sc && el.sc.entity_id === target) scConfig = el.sc.config;
        });
        const segments = segmentsForRooms(scConfig, mapContext.selectedRoomIds);
        if (segments.length === 0) {
            console.warn('[DynamicMap] No mapped room segments found for selection!');
            return;
        }
        if (target.split('.')[0] === 'roborock') applyRoborockMode(mapContext._hass, target, mode.value);
        mapContext._hass.callService('vacuum', 'send_command', {
            entity_id: target,
            command: 'app_segment_clean',
            params: [{ segments, repeat: parseInt(repeats.value) }]
        });
        close();
    };
    mapContext.selectionInterval = setInterval(() => {
        if (!mapContext.isSelectingRooms) { clearInterval(mapContext.selectionInterval); return; }
        const n = mapContext.selectedRoomIds.length;
        startBtn.innerText = `Start Cleaning (${n})`;
        startBtn.style.background = n > 0 ? '#10b981' : '#475569';
    }, 200);

    buttons.appendChild(cancelBtn);
    buttons.appendChild(startBtn);
    ui.appendChild(header);
    ui.appendChild(controls);
    ui.appendChild(buttons);
    mapContext.renderRoot.appendChild(ui);
}

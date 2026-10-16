/**
 * Vacuum room selection: a bottom sheet while the user taps rooms on the
 * map, then app_segment_clean with the mapped segment ids.
 */

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
    ui.className = 'dm-room-select';

    const header = document.createElement('div');
    header.className = 'dm-rs-title';
    header.innerText = 'Select Rooms on Map to Clean';

    const controls = document.createElement('div');
    controls.className = 'dm-rs-row';
    const repeats = document.createElement('select');
    repeats.innerHTML = '<option value="1">1x (Default)</option><option value="2">2x (Deep)</option><option value="3">3x (Max)</option>';
    repeats.className = 'dm-rs-select';
    const mode = document.createElement('select');
    mode.innerHTML = '<option value="vac_mop">Vac & Mop</option><option value="vacuum">Vacuum Only</option><option value="mop">Mop Only</option>';
    mode.className = 'dm-rs-select';
    controls.appendChild(repeats);
    controls.appendChild(mode);

    const close = () => {
        mapContext.isSelectingRooms = false;
        ui.remove();
        mapContext.updateRoomStyles();
        if (mapContext.selectionInterval) clearInterval(mapContext.selectionInterval);
    };
    const buttons = document.createElement('div');
    buttons.className = 'dm-rs-row';
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = 'Cancel';
    cancelBtn.className = 'dm-rs-btn dm-rs-cancel';
    cancelBtn.onclick = close;
    const startBtn = document.createElement('button');
    startBtn.innerText = 'Start Cleaning (0)';
    startBtn.className = 'dm-rs-btn dm-rs-start';
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
        startBtn.classList.toggle('dm-ready', n > 0);
    }, 200);

    buttons.appendChild(cancelBtn);
    buttons.appendChild(startBtn);
    ui.appendChild(header);
    ui.appendChild(controls);
    ui.appendChild(buttons);
    mapContext.renderRoot.appendChild(ui);
}

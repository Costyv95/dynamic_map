import { describe, it, expect, vi } from 'vitest';
import { areaEntities, describeEntity, controlCall, isInteresting } from '../card/RoomEntities.js';
import { buildRoomPanelEl, showRoomPanel, updateRoomPanel, hideRoomPanel } from '../card/RoomPanel.js';

function makeHass() {
    return {
        entities: {
            'light.desk': { area_id: 'office' },
            'switch.fan': { device_id: 'd1' },
            'sensor.temp': { area_id: 'office' },
            'sensor.diag': { area_id: 'office', entity_category: 'diagnostic' },
            'sensor.hidden': { area_id: 'office', hidden: true },
            'light.other': { area_id: 'kitchen' },
            'climate.ac': { area_id: 'office' },
            'binary_sensor.door': { area_id: 'office' },
            'update.firmware': { area_id: 'office' }
        },
        devices: { d1: { area_id: 'office' } },
        states: {
            'light.desk': { state: 'on', attributes: { friendly_name: 'Desk lamp' } },
            'switch.fan': { state: 'off', attributes: { friendly_name: 'Fan' } },
            'sensor.temp': { state: '21.44', attributes: { friendly_name: 'Temperature', device_class: 'temperature', unit_of_measurement: '°C' } },
            'sensor.diag': { state: '1', attributes: {} },
            'sensor.hidden': { state: '1', attributes: {} },
            'light.other': { state: 'on', attributes: {} },
            'climate.ac': { state: 'cool', attributes: { friendly_name: 'AC', temperature: 22, current_temperature: 24.5, target_temp_step: 1 } },
            'binary_sensor.door': { state: 'on', attributes: { friendly_name: 'Door', device_class: 'door' } },
            'update.firmware': { state: 'off', attributes: {} }
        },
        callService: vi.fn()
    };
}

describe('RoomEntities', () => {
    it('lists the area entities via entity or device area, skipping hidden/diagnostic/uninteresting ones, sorted by kind', () => {
        expect(areaEntities(makeHass(), 'office')).toEqual(['light.desk', 'switch.fan', 'climate.ac', 'binary_sensor.door', 'sensor.temp']);
        expect(areaEntities(makeHass(), 'nope')).toEqual([]);
        expect(areaEntities({}, 'office')).toEqual([]);
    });

    it('keeps sensors with a unit or a known class', () => {
        expect(isInteresting('sensor.x', { attributes: { unit_of_measurement: 'W' } })).toBe(true);
        expect(isInteresting('sensor.x', { attributes: {} })).toBe(false);
        expect(isInteresting('binary_sensor.x', { attributes: { device_class: 'motion' } })).toBe(true);
    });

    it('describes each kind with a value and an on flag', () => {
        const h = makeHass();
        expect(describeEntity(h, 'light.desk')).toMatchObject({ kind: 'toggle', on: true, value: 'On', name: 'Desk lamp', icon: '💡' });
        expect(describeEntity(h, 'sensor.temp')).toMatchObject({ kind: 'value', value: '21.4°C' });
        expect(describeEntity(h, 'climate.ac')).toMatchObject({ kind: 'climate', value: '22°', current: 24.5, target: 22, step: 1 });
        expect(describeEntity(h, 'binary_sensor.door')).toMatchObject({ kind: 'binary', value: 'Open', on: true });
    });

    it('maps controls to service calls', () => {
        const h = makeHass();
        expect(controlCall(describeEntity(h, 'light.desk'))).toEqual({ domain: 'light', service: 'toggle', data: { entity_id: 'light.desk' } });
        expect(controlCall(describeEntity(h, 'climate.ac'), 'up')).toEqual({ domain: 'climate', service: 'set_temperature', data: { entity_id: 'climate.ac', temperature: 23 } });
        expect(controlCall(describeEntity(h, 'sensor.temp'))).toBeNull();
    });
});

describe('RoomPanel', () => {
    function host(hass) {
        const renderRoot = document.createElement('div');
        return { renderRoot, config: {}, _hass: hass, zoomOutToDefault: vi.fn(), dispatchEvent: vi.fn() };
    }

    it('shows the area rows for the focused room and toggles on click', () => {
        const hass = makeHass();
        const h = host(hass);
        buildRoomPanelEl(h);
        showRoomPanel(h, { id: 'r', name: 'Office', area_id: 'office' });
        expect(h.roomPanel.classList.contains('dm-visible')).toBe(true);
        expect(h.roomPanel.querySelector('.dm-rp-title').textContent).toBe('Office');
        const rowsEl = h.roomPanel.querySelectorAll('.dm-rp-list .dm-rp-row');
        expect(rowsEl.length).toBe(5);
        rowsEl[0].click();
        expect(hass.callService).toHaveBeenCalledWith('light', 'toggle', { entity_id: 'light.desk' });
        // The open door is listed first under "Needs attention"; tapping it opens more-info.
        const alerts = h.roomPanel.querySelectorAll('.dm-rp-attention .dm-rp-alert');
        expect(alerts.length).toBe(1);
        expect(alerts[0].textContent).toContain('Door');
        alerts[0].click();
        expect(h.dispatchEvent.mock.calls[0][0].detail).toEqual({ entityId: 'binary_sensor.door' });
        hideRoomPanel(h);
        expect(h.roomPanel.classList.contains('dm-visible')).toBe(false);
    });

    it('renders unavailable devices without controls; the row opens more-info', () => {
        const hass = makeHass();
        hass.states['light.desk'].state = 'unavailable';
        const h = host(hass);
        buildRoomPanelEl(h);
        showRoomPanel(h, { id: 'r', name: 'Office', area_id: 'office' });
        const row = h.roomPanel.querySelector('.dm-rp-list .dm-rp-row');
        expect(row.classList.contains('dm-rp-unavailable')).toBe(true);
        expect(row.querySelector('.dm-rp-switch')).toBeNull();
        expect(row.querySelector('.dm-rp-value').textContent).toBe('Unavailable');
        row.click();
        expect(hass.callService).not.toHaveBeenCalled();
        expect(h.dispatchEvent.mock.calls.at(-1)[0].detail).toEqual({ entityId: 'light.desk' });
    });

    it('explains how to link an area when the room has none, and honours room_panel: false', () => {
        const h = host(makeHass());
        buildRoomPanelEl(h);
        showRoomPanel(h, { id: 'r', name: 'Attic' });
        expect(h.roomPanel.textContent).toContain('Link this room');
        const off = host(makeHass());
        off.config.room_panel = false;
        buildRoomPanelEl(off);
        showRoomPanel(off, { id: 'r', area_id: 'office' });
        expect(off.roomPanel.classList.contains('dm-visible')).toBe(false);
        showRoomPanel(off, { id: 'r', area_id: 'office' }, true);   // alert badge tap forces it open
        expect(off.roomPanel.classList.contains('dm-visible')).toBe(true);
    });

    it('re-renders from a new hass while visible', () => {
        const hass = makeHass();
        const h = host(hass);
        buildRoomPanelEl(h);
        showRoomPanel(h, { id: 'r', name: 'Office', area_id: 'office' });
        hass.states['light.desk'] = { state: 'off', attributes: { friendly_name: 'Desk lamp' } };
        updateRoomPanel(h, hass);
        expect(h.roomPanel.querySelector('.dm-rp-row').classList.contains('dm-on')).toBe(false);
    });
});

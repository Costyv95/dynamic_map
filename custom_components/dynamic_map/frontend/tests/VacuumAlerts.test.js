import { describe, it, expect, vi } from 'vitest';
import { vacuumAlerts, vacuumRoom, roomVacuumAlerts, knownVacuums } from '../card/VacuumAlerts.js';
import { roomOfBadge } from '../card/BadgeRoom.js';
import { roomAlerts, alertKinds } from '../card/RoomAlerts.js';
import { buildRoomPanelEl, showRoomPanel } from '../card/RoomPanel.js';

function makeHass() {
    return {
        entities: { 'vacuum.saros': { area_id: null } }, devices: {},
        states: {
            'vacuum.saros': { state: 'docked', attributes: { friendly_name: 'Saros 20X' } },
            'binary_sensor.saros_water_shortage': { state: 'on', attributes: { device_class: 'problem', friendly_name: 'Saros Water shortage' } },
            'binary_sensor.saros_dock_dirty_water_box': { state: 'on', attributes: { device_class: 'problem' } },
            'binary_sensor.saros_dock_clean_water_box': { state: 'off', attributes: { device_class: 'problem' } },
            'binary_sensor.saros_cleaning': { state: 'on', attributes: { device_class: 'running' } },
            'sensor.saros_sensor_time_left': { state: '0', attributes: { unit_of_measurement: 'h' } },
            'sensor.saros_main_brush_time_left': { state: '120', attributes: { unit_of_measurement: 'h' } },
            'sensor.saros_vacuum_error': { state: 'none', attributes: {} },
            'sensor.saros_dock_dock_error': { state: 'water_tank_missing', attributes: {} },
            'sensor.saros_current_room': { state: 'Kitchen', attributes: {} },
            'button.saros_reset_sensor_consumable': { state: 'unknown', attributes: {} }
        },
        callService: vi.fn()
    };
}
const rooms = [{ id: 'k', name: 'Kitchen', area_id: 'kitchen', polygon: [[0, 0], [50, 0], [50, 50], [0, 50]] }, { id: 'l', name: 'Living', area_id: 'living', polygon: [[50, 0], [100, 0], [100, 50], [50, 50]] }];

describe('vacuum alerts', () => {
    it('derives to-dos from water, consumable and error entities, with a reset action where a button exists', () => {
        const alerts = vacuumAlerts(makeHass(), 'vacuum.saros');
        expect(alerts.map(a => `${a.kind}:${a.name}`)).toEqual([
            'danger:Dock error: water tank missing', 'vacuum:Add water to the robot', 'vacuum:Empty the dock\'s dirty water tank', 'vacuum:Clean the sensors'
        ]);
        expect(alerts[3].action).toMatchObject({ domain: 'button', service: 'press', data: { entity_id: 'button.saros_reset_sensor_consumable' } });
        expect(alerts.every(a => a.robot === 'Saros 20X' && a.icon === '🤖')).toBe(true);
        expect(vacuumAlerts(makeHass(), 'vacuum.nope')).toEqual([]);
    });

    it('places the to-dos in the badge\'s room, else the area room, else the room named by the current-room sensor', () => {
        const hass = makeHass();
        const badge = { id: 'v', type: 'vacuum', entity_id: 'vacuum.saros', position: { horizontal: [75, 25], vertical: [75, 25] } };
        expect(roomOfBadge(rooms, badge).id).toBe('l');
        expect(vacuumRoom({ rooms, shortcuts: [badge] }, hass, 'vacuum.saros').id).toBe('l');
        expect(vacuumRoom({ rooms, shortcuts: [], config: { vacuum_entity: 'vacuum.saros' } }, hass, 'vacuum.saros').id).toBe('k');   // "Kitchen" sensor
        hass.entities['vacuum.saros'].area_id = 'living';
        expect(vacuumRoom({ rooms, shortcuts: [] }, hass, 'vacuum.saros').id).toBe('l');
        expect(knownVacuums({ shortcuts: [badge], config: { vacuum_entity: 'vacuum.saros' } })).toEqual(['vacuum.saros']);
    });

    it('roomAlerts merges them for that room only, vacuum kind on by default, and the panel offers Done', () => {
        const hass = makeHass();
        const host = { rooms, shortcuts: [], config: { vacuum_entity: 'vacuum.saros' }, renderRoot: document.createElement('div'), _hass: hass, zoomOutToDefault: vi.fn(), dispatchEvent: vi.fn() };
        expect(alertKinds({})).toEqual(['open', 'danger', 'vacuum']);
        expect(roomAlerts(hass, rooms[0], alertKinds({}), host).length).toBe(4);
        expect(roomAlerts(hass, rooms[1], alertKinds({}), host)).toEqual([]);
        expect(roomAlerts(hass, rooms[0], ['open', 'danger'], host).length).toBe(1);   // only the dock error
        expect(roomVacuumAlerts(host, hass, rooms[0], ['vacuum']).length).toBe(3);
        buildRoomPanelEl(host);
        showRoomPanel(host, rooms[0]);
        const rows = [...host.roomPanel.querySelectorAll('.dm-rp-attention .dm-rp-alert')];
        expect(rows.length).toBe(4);
        expect(rows[3].textContent).toContain('Clean the sensors');
        rows[3].querySelector('button').click();
        expect(hass.callService).toHaveBeenCalledWith('button', 'press', { entity_id: 'button.saros_reset_sensor_consumable' });
    });
});

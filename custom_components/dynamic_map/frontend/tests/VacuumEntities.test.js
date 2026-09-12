import { describe, it, expect } from 'vitest';
import { vacuumDevices, vacuumIndex } from '../card/VacuumEntities.js';
import { vacuumAlerts, vacuumRoom } from '../card/VacuumAlerts.js';

// A robot whose entity ids have all been renamed by hand: only the registry's
// translation keys still identify what each entity is.
function renamedHass(extra = {}) {
    const devices = {
        d1: { id: 'd1', name: 'Saros 20X', model: 'roborock.vacuum.a288', config_entries: ['e1'] },
        d2: { id: 'd2', name: 'Saros 20X Dock', model: 'roborock.vacuum.a288 Dock', config_entries: ['e1'] },
        d3: { id: 'd3', name: 'Hallway sensor', model: 'zigbee', config_entries: ['e2'] }
    };
    const entities = {
        'vacuum.robot': { device_id: 'd1', translation_key: 'roborock' },
        'sensor.robot_dust': { device_id: 'd1', translation_key: 'sensor_time_left' },
        'sensor.robot_brush': { device_id: 'd1', translation_key: 'main_brush_time_left' },
        'button.clean_the_sensors': { device_id: 'd1', translation_key: 'reset_sensor_consumable' },
        'sensor.where_am_i': { device_id: 'd1', translation_key: 'current_room' },
        'binary_sensor.dock_dirty': { device_id: 'd2', translation_key: 'dirty_box_full' },
        'sensor.dock_trouble': { device_id: 'd2', translation_key: 'dock_error' },
        'binary_sensor.dock_drying': { device_id: 'd2', translation_key: 'mop_drying_status' },
        'binary_sensor.hallway_trouble': { device_id: 'd3', translation_key: 'problem' }
    };
    const states = {
        'vacuum.robot': { state: 'docked', attributes: { friendly_name: 'Saros 20X' } },
        'sensor.robot_dust': { state: '0', attributes: {} },
        'sensor.robot_brush': { state: '150', attributes: {} },
        'button.clean_the_sensors': { state: 'unknown', attributes: {} },
        'sensor.where_am_i': { state: 'Kitchen', attributes: {} },
        'binary_sensor.dock_dirty': { state: 'on', attributes: { device_class: 'problem' } },
        'sensor.dock_trouble': { state: 'water_tank_missing', attributes: {} },
        'binary_sensor.dock_drying': { state: 'on', attributes: { device_class: 'running' } },
        'binary_sensor.hallway_trouble': { state: 'on', attributes: { device_class: 'problem', friendly_name: 'Hallway problem' } }
    };
    return { devices, entities, states, ...extra };
}
const rooms = [{ id: 'k', name: 'Kitchen', area_id: 'kitchen' }, { id: 'l', name: 'Living', area_id: 'living' }];

describe('vacuum entity resolution', () => {
    it('collects the robot device and its dock, by model or name, never another integration\'s device', () => {
        expect(vacuumDevices(renamedHass(), 'vacuum.robot').sort()).toEqual(['d1', 'd2']);
        const linked = renamedHass();
        linked.devices.d2 = { id: 'd2', name: 'Charger', model: 'other', config_entries: ['e9'], via_device_id: 'd1' };
        expect(vacuumDevices(linked, 'vacuum.robot').sort()).toEqual(['d1', 'd2']);
        expect(vacuumDevices({ states: {} }, 'vacuum.robot')).toEqual([]);
        expect(vacuumDevices({ entities: { 'vacuum.robot': { device_id: 'd1' } } }, 'vacuum.robot')).toEqual(['d1']);
    });

    it('finds entities by translation key and ignores a registry entry with no state', () => {
        const hass = renamedHass();
        const idx = vacuumIndex(hass, 'vacuum.robot');
        expect(idx.find('sensor', 'sensor_time_left')).toBe('sensor.robot_dust');
        expect(idx.find('button', 'reset_sensor_consumable')).toBe('button.clean_the_sensors');
        expect(idx.find('sensor', 'nothing_like_this')).toBe(null);
        expect(idx.binarySensors().sort()).toEqual(['binary_sensor.dock_dirty', 'binary_sensor.dock_drying']);
        delete hass.states['button.clean_the_sensors'];
        expect(vacuumIndex(hass, 'vacuum.robot').find('button', 'reset_sensor_consumable')).toBe(null);
    });

    it('still reads renamed robots: to-dos, their labels and their reset buttons', () => {
        const alerts = vacuumAlerts(renamedHass(), 'vacuum.robot');
        expect(alerts.map(a => `${a.kind}:${a.name}`)).toEqual([
            'danger:Dock error: water tank missing', 'vacuum:Empty the dock\'s dirty water tank', 'vacuum:Clean the sensors'
        ]);
        expect(alerts[2].action.data).toEqual({ entity_id: 'button.clean_the_sensors' });
        expect(alerts.every(a => a.robot === 'Saros 20X')).toBe(true);
    });

    it('uses the current-room sensor even when it was renamed', () => {
        expect(vacuumRoom({ rooms, shortcuts: [] }, renamedHass(), 'vacuum.robot').id).toBe('k');
    });
});

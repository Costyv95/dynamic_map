// #1751: four small render defects from the #1743 review, one test each.
import { describe, it, expect, vi } from 'vitest';
import '../custom-svg-map.js';
import { MapShortcut } from '../shortcuts/MapShortcut.js';
import { buildRoomAlerts, updateRoomAlerts } from '../card/RoomAlerts.js';
import { roomTemperatureEntity } from '../card/RoomTemperature.js';

const svgNS = 'http://www.w3.org/2000/svg';

describe('#1751 render defects', () => {
    it('drops a per-state size once the state stops matching', () => {
        const sc = { id: 'lamp', entity_id: 'light.lamp', position: [50, 50], scale: 1,
            config: { states: [{ id: 'big', state_entity: 'light.lamp', operator: '==', value: 'on', scale: 3 }] } };
        const s = new MapShortcut(sc, svgNS, 1000, 1000, { _hass: {}, imgW: 1000, imgH: 1000 });
        s.updateState({ states: { 'light.lamp': { state: 'on' } } });
        expect(s.scaleX).toBe(3);
        s.updateState({ states: { 'light.lamp': { state: 'off' } } });
        expect(s.scaleX).toBe(1);
        expect(s.scaleY).toBe(1);
    });

    it('counts an open door once when two rooms share its area', () => {
        const hass = {
            entities: { 'binary_sensor.door': { area_id: 'hall' } }, devices: {},
            states: { 'binary_sensor.door': { state: 'on', attributes: { device_class: 'door' } } }
        };
        const a = { id: 'a', area_id: 'hall', polygon: [[10, 10], [30, 10], [30, 30], [10, 30]] };
        const b = { id: 'b', area_id: 'hall', polygon: [[40, 10], [60, 10], [60, 30], [40, 30]] };
        const host = { svgNS, mapRoot: document.createElementNS(svgNS, 'g'), renderRoot: document.createElement('div'), rooms: [a, b], imgW: 1000, imgH: 1000, config: {} };
        buildRoomAlerts(host);
        updateRoomAlerts(host, hass);
        expect(host.renderRoot.querySelector('.dm-alert-legend').textContent).toBe('1 open door/window');
    });

    it('never takes a wind-direction sensor (unit °) as the room temperature', () => {
        const hass = {
            entities: { 'sensor.wind': { area_id: 'garden' }, 'sensor.t': { area_id: 'garden' } }, devices: {},
            states: { 'sensor.wind': { state: '270', attributes: { unit_of_measurement: '°' } },
                'sensor.t': { state: '14', attributes: { unit_of_measurement: '°F' } } }
        };
        expect(roomTemperatureEntity({ shortcuts: [] }, hass, { id: 'g', area_id: 'garden' })).toBe('sensor.t');
        delete hass.entities['sensor.t'];
        expect(roomTemperatureEntity({ shortcuts: [] }, hass, { id: 'g', area_id: 'garden' })).toBeNull();
    });

    it('keeps the badge counter-flip on a flipped, unrotated floor across hass updates', () => {
        const card = document.createElement('custom-svg-map');
        card.isRotated = false;
        card.mapScaleX = -1;
        card.mapScaleY = 1;
        card.shortcutElements = { s: { updateState: () => true } };
        card.applyShortcutTransforms = vi.fn();
        card.updateLiveFeatures = () => {};
        card.hass = { states: {} };
        expect(card.applyShortcutTransforms).toHaveBeenCalledWith(-1, 1);
    });
});

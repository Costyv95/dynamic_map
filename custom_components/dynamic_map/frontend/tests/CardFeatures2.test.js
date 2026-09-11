import { describe, it, expect, vi } from 'vitest';
import { normalizeAction, buildQuickActions, updateQuickActions, lightsOnCount } from '../card/QuickActions.js';
import { tempColor, roomTemperatureEntity, roomTint, tintSignature } from '../card/RoomTemperature.js';
import { tintPalette, updateRoomStyles } from '../core/RoomStyles.js';

describe('built-in all-lights-off chip', () => {
    it('leads the chips with the count of lights on, needs two taps, hides when no light is on, and can be turned off', () => {
        const hass = { states: { 'light.a': { state: 'on' }, 'light.b': { state: 'on' }, 'light.c': { state: 'off' }, 'switch.x': { state: 'on' } }, callService: vi.fn() };
        expect(lightsOnCount(hass)).toBe(2);
        const host = { renderRoot: document.createElement('div'), config: {}, _hass: hass };
        buildQuickActions(host);
        const chip = host.renderRoot.querySelector('.dm-quick-chip');
        expect(chip.hidden).toBe(false);
        expect(chip.textContent).toContain('All lights off · 2');
        chip.click();
        expect(hass.callService).not.toHaveBeenCalled();              // armed
        expect(chip.textContent).toContain('Tap again');
        chip.click();
        expect(hass.callService).toHaveBeenCalledWith('light', 'turn_off', { entity_id: 'all' });
        hass.states['light.a'].state = 'off'; hass.states['light.b'].state = 'off';
        updateQuickActions(host, hass);
        expect(chip.hidden).toBe(true);
        const off = { renderRoot: document.createElement('div'), config: { lights_off_button: false }, _hass: hass };
        buildQuickActions(off);
        expect(off.renderRoot.querySelector('.dm-quick-chip')).toBeNull();
    });
});

describe('quick actions', () => {
    it('normalises service and entity entries', () => {
        expect(normalizeAction({ name: 'All off', icon: '🌙', service: 'light.turn_off', data: { entity_id: 'all' } }))
            .toEqual({ name: 'All off', icon: '🌙', call: { domain: 'light', service: 'turn_off', data: { entity_id: 'all' } }, entity: null, confirm: false });
        expect(normalizeAction({ entity: 'switch.garden_pump' })).toMatchObject({ name: 'garden pump', call: { domain: 'switch', service: 'toggle', data: { entity_id: 'switch.garden_pump' } }, entity: 'switch.garden_pump' });
        expect(normalizeAction({ name: 'broken' })).toBeNull();
    });

    it('renders chips, fires services, confirms when asked and lights chips whose entity is on', () => {
        vi.useFakeTimers();
        const host = { renderRoot: document.createElement('div'), config: { lights_off_button: false, quick_actions: [
            { name: 'All off', service: 'light.turn_off', data: { entity_id: 'all' }, confirm: true },
            { entity: 'switch.pump', name: 'Pump' }
        ] }, _hass: { states: { 'switch.pump': { state: 'on' } }, callService: vi.fn() } };
        buildQuickActions(host);
        const chips = host.renderRoot.querySelectorAll('.dm-quick-chip');
        expect(chips.length).toBe(2);
        expect(chips[1].classList.contains('dm-on')).toBe(true);
        chips[0].click();
        expect(host._hass.callService).not.toHaveBeenCalled();
        expect(chips[0].textContent).toContain('Tap again');
        chips[0].click();
        expect(host._hass.callService).toHaveBeenCalledWith('light', 'turn_off', { entity_id: 'all' });
        chips[1].click();
        expect(host._hass.callService).toHaveBeenCalledWith('switch', 'toggle', { entity_id: 'switch.pump' });
        updateQuickActions(host, { states: { 'switch.pump': { state: 'off' } } });
        expect(chips[1].classList.contains('dm-on')).toBe(false);
        vi.useRealTimers();
    });
});

describe('room temperature tint', () => {
    it('maps temperatures across the range to blue, green, orange, red', () => {
        expect(tempColor(16)).toBe('rgb(59, 130, 246)');
        expect(tempColor(22)).toBe('rgb(16, 185, 129)');
        expect(tempColor(28)).toBe('rgb(239, 68, 68)');
        expect(tempColor(NaN)).toBeNull();
        expect(tempColor(100, 16, 28)).toBe('rgb(239, 68, 68)');
    });

    it('finds the reading from the room, a sensor badge, or the area', () => {
        const hass = {
            states: { 'sensor.a': { state: '21', attributes: { device_class: 'temperature' } }, 'sensor.b': { state: '19', attributes: { unit_of_measurement: '°C' } }, 'sensor.c': { state: '25', attributes: { device_class: 'temperature' } } },
            entities: { 'sensor.c': { area_id: 'office' } }, devices: {}
        };
        const host = { shortcuts: [{ id: 's', parent: 'r2', type: 'sensor', config: { temperature_entity: 'sensor.b' } }], config: { room_temperature: true } };
        expect(roomTemperatureEntity(host, hass, { id: 'r1', temperature_entity: 'sensor.a' })).toBe('sensor.a');
        expect(roomTemperatureEntity(host, hass, { id: 'r2' })).toBe('sensor.b');
        expect(roomTemperatureEntity(host, hass, { id: 'r3', area_id: 'office' })).toBe('sensor.c');
        expect(roomTemperatureEntity(host, hass, { id: 'r4' })).toBeNull();
        // A live sensor badge inside the polygon beats a dead area sensor; a dead area sensor is still the last resort.
        hass.states['sensor.dead'] = { state: 'unavailable', attributes: { device_class: 'temperature' } };
        hass.entities['sensor.dead'] = { area_id: 'kitchen' };
        host.shortcuts.push({ id: 'k', type: 'sensor', position: { horizontal: [20, 20], vertical: [20, 20] }, config: { temperature_entity: 'sensor.a' } });
        const kitchen = { id: 'k1', area_id: 'kitchen', polygon: [[10, 10], [30, 10], [30, 30], [10, 30]] };
        expect(roomTemperatureEntity(host, hass, kitchen)).toBe('sensor.a');
        expect(roomTemperatureEntity(host, hass, { id: 'k2', area_id: 'kitchen', polygon: [[50, 50], [60, 50], [60, 60], [50, 60]] })).toBe('sensor.dead');
        expect(roomTint(host, hass, { id: 'r2' })).toBe(tempColor(19));
        expect(roomTint({ config: {} }, hass, { id: 'r2' })).toBeNull();
        host.rooms = [{ id: 'r2' }, { id: 'r4' }];
        expect(tintSignature(host, hass)).toBe(`${tempColor(19)}|-`);
    });

    it('updateRoomStyles uses the tint palette when the host provides a tint', () => {
        const svgNS = 'http://www.w3.org/2000/svg';
        const mapRoot = document.createElementNS(svgNS, 'g');
        const poly = document.createElementNS(svgNS, 'polygon');
        poly.classList.add('room-polygon');
        mapRoot.appendChild(poly);
        const host = { mapRoot, rooms: [{ id: 'r', color: '#336699' }], _hass: { states: {} }, roomTint: () => 'rgb(10, 20, 30)' };
        updateRoomStyles(host);
        expect(poly.getAttribute('stroke')).toBe('rgba(10, 20, 30, 1)');
        expect(tintPalette('nope').solid).toBe('rgb(100, 116, 139)');
    });
});

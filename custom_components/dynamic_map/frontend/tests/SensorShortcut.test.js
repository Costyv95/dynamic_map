import { describe, it, expect } from 'vitest';
import { SensorShortcut } from '../shortcuts/SensorShortcut.js';

describe('SensorShortcut', () => {
    const scData = {
        id: 'sensor_sc_123',
        entity_id: 'input_boolean.sensor_living_room',
        position: [40, 60],
        config: {
            color: '#10b981',
            states: [
                {
                    id: 'st_t_cold',
                    name: 'Cold Temp',
                    display_entity: 'sensor.living_room_temperature',
                    unit: '°',
                    color: '#3b82f6',
                    icon: '❄️',
                    conditions: [
                        { entity: 'input_boolean.sensor_living_room', operator: '==', value: 'on' },
                        { entity: 'sensor.living_room_temperature', operator: '<', value: '19' }
                    ]
                },
                {
                    id: 'st_t_comfort',
                    name: 'Comfort Temp',
                    display_entity: 'sensor.living_room_temperature',
                    unit: '°',
                    color: '#10b981',
                    icon: '🌡️',
                    conditions: [
                        { entity: 'input_boolean.sensor_living_room', operator: '==', value: 'on' },
                        { entity: 'sensor.living_room_temperature', operator: 'between', value: '19-22' }
                    ]
                },
                {
                    id: 'st_h_dry',
                    name: 'Dry Hum',
                    display_entity: 'sensor.living_room_humidity',
                    unit: '%',
                    color: '#eab308',
                    icon: '🌵',
                    conditions: [
                        { entity: 'input_boolean.sensor_living_room', operator: '==', value: 'off' },
                        { entity: 'sensor.living_room_humidity', operator: '<=', value: '35' }
                    ]
                },
                {
                    id: 'st_h_ok',
                    name: 'Comfort Hum',
                    display_entity: 'sensor.living_room_humidity',
                    unit: '%',
                    color: '#10b981',
                    icon: '💧',
                    conditions: [
                        { entity: 'input_boolean.sensor_living_room', operator: '==', value: 'off' },
                        { entity: 'sensor.living_room_humidity', operator: 'between', value: '36-60' }
                    ]
                }
            ]
        }
    };

    const svgNS = 'http://www.w3.org/2000/svg';
    const mapContext = {
        _hass: {},
        imgW: 1000,
        imgH: 1000,
        isRotated: false
    };

    it('should initialize and render pill shape and text elements', () => {
        const shortcut = new SensorShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.render();
        
        expect(shortcut.shape).toBeDefined();
        expect(shortcut.shape.tagName.toLowerCase()).toBe('rect');
        expect(shortcut.iconText).toBeDefined();
        expect(shortcut.emojiText).toBeDefined();
        
        // Assert pill-shape default radius
        expect(shortcut.shape.getAttribute('rx')).toBe('8');
        expect(shortcut.shape.getAttribute('ry')).toBe('8');
    });

    it('should display active temperature value and apply correct range state when input_boolean is on', () => {
        const shortcut = new SensorShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.render();
        
        const mockHass = {
            states: {
                'input_boolean.sensor_living_room': { state: 'on' },
                'sensor.living_room_temperature': { state: '21.4' },
                'sensor.living_room_humidity': { state: '45' }
            }
        };

        shortcut.updateState(mockHass);

        // When input_boolean is 'on' and temp is 21.4, Comfort Temp matches -> color #10b981, icon 🌡️, value 21°
        expect(shortcut.activeState.id).toBe('st_t_comfort');
        expect(shortcut.iconText.textContent).toBe('21°');
        expect(shortcut.shape.getAttribute('fill')).toBe('#10b981');
        expect(shortcut.emojiText.textContent).toBe('🌡️');
    });

    it('should display cold temperature range when input_boolean is on and temperature is low', () => {
        const shortcut = new SensorShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.render();
        
        const mockHass = {
            states: {
                'input_boolean.sensor_living_room': { state: 'on' },
                'sensor.living_room_temperature': { state: '17.8' },
                'sensor.living_room_humidity': { state: '45' }
            }
        };

        shortcut.updateState(mockHass);

        // Cold Temp matches -> color #3b82f6, icon ❄️, value 18°
        expect(shortcut.activeState.id).toBe('st_t_cold');
        expect(shortcut.iconText.textContent).toBe('18°');
        expect(shortcut.shape.getAttribute('fill')).toBe('#3b82f6');
        expect(shortcut.emojiText.textContent).toBe('❄️');
    });

    it('should display humidity range when input_boolean is off', () => {
        const shortcut = new SensorShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.render();
        
        const mockHass = {
            states: {
                'input_boolean.sensor_living_room': { state: 'off' },
                'sensor.living_room_temperature': { state: '21.4' },
                'sensor.living_room_humidity': { state: '32.1' }
            }
        };

        shortcut.updateState(mockHass);

        // When input_boolean is 'off' and humidity is 32.1, Dry Hum matches -> color #eab308, icon 🌵, value 32%
        expect(shortcut.activeState.id).toBe('st_h_dry');
        expect(shortcut.iconText.textContent).toBe('32%');
        expect(shortcut.shape.getAttribute('fill')).toBe('#eab308');
        expect(shortcut.emojiText.textContent).toBe('🌵');
    });

    it('should apply desaturation filter and strike-through on unavailable sensor state', () => {
        const shortcut = new SensorShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.render();
        
        const mockHass = {
            states: {
                'input_boolean.sensor_living_room': { state: 'unavailable' }
            }
        };

        shortcut.updateState(mockHass);

        const expectedFilter = 'grayscale(100%) opacity(45%)';
        expect(shortcut.bgGroup.style.filter).toBe(expectedFilter);
        expect(shortcut.unavailableLine.style.display).toBe('block');
    });
});

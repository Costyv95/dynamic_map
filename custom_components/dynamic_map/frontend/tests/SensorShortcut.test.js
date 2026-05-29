import { describe, it, expect } from 'vitest';
import { SensorShortcut } from '../shortcuts/SensorShortcut.js';

describe('SensorShortcut', () => {
    const scData = {
        id: 'sensor_sc_123',
        entity_id: 'sensor.living_room_temperature',
        position: [40, 60],
        config: {
            temperature_entity: 'sensor.living_room_temperature',
            humidity_entity: 'sensor.living_room_humidity',
            default_measurement: 'temperature',
            states: [
                {
                    id: 'st_t_cold',
                    name: 'Cold Temp',
                    state_entity: 'sensor.living_room_temperature',
                    operator: '<',
                    value: '19',
                    color: '#3b82f6',
                    icon: '❄️'
                },
                {
                    id: 'st_t_ok',
                    name: 'Comfort Temp',
                    state_entity: 'sensor.living_room_temperature',
                    operator: 'between',
                    value: '19-22',
                    color: '#10b981',
                    icon: '🌡️'
                },
                {
                    id: 'st_t_hot',
                    name: 'Hot Temp',
                    state_entity: 'sensor.living_room_temperature',
                    operator: '>',
                    value: '22',
                    color: '#f97316',
                    icon: '🔥'
                },
                {
                    id: 'st_h_dry',
                    name: 'Dry Hum',
                    state_entity: 'sensor.living_room_humidity',
                    operator: '<=',
                    value: '35',
                    color: '#eab308',
                    icon: '🌵'
                },
                {
                    id: 'st_h_ok',
                    name: 'Comfort Hum',
                    state_entity: 'sensor.living_room_humidity',
                    operator: 'between',
                    value: '36-60',
                    color: '#10b981',
                    icon: '💧'
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

    it('should display active temperature value and apply correct comfortable range state', () => {
        const shortcut = new SensorShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.render();
        
        const mockHass = {
            states: {
                'sensor.living_room_temperature': { state: '21.4' },
                'sensor.living_room_humidity': { state: '45' }
            }
        };

        shortcut.updateState(mockHass);

        // Under 21.4 degrees, Temp Comfort (19-22) matches -> color #10b981, icon 🌡️
        expect(shortcut.activeMeasurement).toBe('temperature');
        expect(shortcut.iconText.textContent).toBe('21°');
        expect(shortcut.shape.getAttribute('fill')).toBe('#10b981');
        expect(shortcut.emojiText.textContent).toBe('🌡️');
    });

    it('should match cold range state for temperature under 19', () => {
        const shortcut = new SensorShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.render();
        
        const mockHass = {
            states: {
                'sensor.living_room_temperature': { state: '17.8' },
                'sensor.living_room_humidity': { state: '45' }
            }
        };

        shortcut.updateState(mockHass);

        // Temp Cold matches -> color #3b82f6, icon ❄️
        expect(shortcut.iconText.textContent).toBe('18°');
        expect(shortcut.shape.getAttribute('fill')).toBe('#3b82f6');
        expect(shortcut.emojiText.textContent).toBe('❄️');
    });

    it('should cycle measurement type and update rendering on click', () => {
        const shortcut = new SensorShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.render();
        
        const mockHass = {
            states: {
                'sensor.living_room_temperature': { state: '21.4' },
                'sensor.living_room_humidity': { state: '32.1' }
            }
        };
        mapContext._hass = mockHass;

        shortcut.updateState(mockHass);
        expect(shortcut.activeMeasurement).toBe('temperature');
        expect(shortcut.iconText.textContent).toBe('21°');

        // Click the shortcut to cycle to humidity
        shortcut.onClick(new window.Event('click'));

        expect(shortcut.activeMeasurement).toBe('humidity');
        // Under 32.1% humidity, Dry Hum (<= 35) matches -> color #eab308, icon 🌵
        expect(shortcut.iconText.textContent).toBe('32%');
        expect(shortcut.shape.getAttribute('fill')).toBe('#eab308');
        expect(shortcut.emojiText.textContent).toBe('🌵');

        // Click again to cycle back to temperature
        shortcut.onClick(new window.Event('click'));
        expect(shortcut.activeMeasurement).toBe('temperature');
        expect(shortcut.iconText.textContent).toBe('21°');
    });

    it('should apply desaturation filter and strike-through on unavailable sensor state', () => {
        const shortcut = new SensorShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.render();
        
        const mockHass = {
            states: {
                'sensor.living_room_temperature': { state: 'unavailable' }
            }
        };

        shortcut.updateState(mockHass);

        const expectedFilter = 'grayscale(100%) opacity(45%)';
        expect(shortcut.bgGroup.style.filter).toBe(expectedFilter);
        expect(shortcut.unavailableLine.style.display).toBe('block');
    });
});

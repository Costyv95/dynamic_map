import { describe, it, expect } from 'vitest';
import { MapShortcut } from '../shortcuts/MapShortcut.js';

describe('SensorShortcut / MapShortcut Sensor Integration', () => {
    const scData = {
        id: 'sensor_sc_123',
        entity_id: 'input_boolean.sensor_living_room',
        position: [40, 60],
        type: 'sensor',
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
                        { state_entity: 'input_boolean.sensor_living_room', operator: '==', value: 'on' },
                        { state_entity: 'sensor.living_room_temperature', operator: '<', value: '19' }
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
                        { state_entity: 'input_boolean.sensor_living_room', operator: '==', value: 'on' },
                        { state_entity: 'sensor.living_room_temperature', operator: 'between', value: '19-22' }
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
                        { state_entity: 'input_boolean.sensor_living_room', operator: '==', value: 'off' },
                        { state_entity: 'sensor.living_room_humidity', operator: '<=', value: '35' }
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
                        { state_entity: 'input_boolean.sensor_living_room', operator: '==', value: 'off' },
                        { state_entity: 'sensor.living_room_humidity', operator: 'between', value: '36-60' }
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
        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        
        const mockHass = {
            states: {
                'input_boolean.sensor_living_room': { state: 'on' },
                'sensor.living_room_temperature': { state: '21.4' },
                'sensor.living_room_humidity': { state: '45' }
            }
        };
        shortcut.updateState(mockHass);
        
        expect(shortcut.shape).toBeDefined();
        expect(shortcut.shape.tagName.toLowerCase()).toBe('rect');
        expect(shortcut.iconText).toBeDefined();
        expect(shortcut.emojiText).toBeDefined();
        
        // Assert pill-shape default radius
        expect(shortcut.shape.getAttribute('rx')).toBe('8');
        expect(shortcut.shape.getAttribute('ry')).toBe('8');
    });

    it('should display active temperature value and apply correct range state when input_boolean is on', () => {
        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        
        const mockHass = {
            states: {
                'input_boolean.sensor_living_room': { state: 'on' },
                'sensor.living_room_temperature': { state: '21.4' },
                'sensor.living_room_humidity': { state: '45' }
            }
        };

        shortcut.updateState(mockHass);

        // Comfort Temp matches -> color #10b981, icon 🌡️, value 21.4°
        expect(shortcut.activeState.id).toBe('st_t_comfort');
        expect(shortcut.iconText.textContent).toBe('21.4°');
        expect(shortcut.shape.getAttribute('fill')).toBe('#10b981');
        expect(shortcut.emojiText.textContent).toBe('🌡️');
    });

    it('should display cold temperature range when input_boolean is on and temperature is low', () => {
        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        
        const mockHass = {
            states: {
                'input_boolean.sensor_living_room': { state: 'on' },
                'sensor.living_room_temperature': { state: '17.8' },
                'sensor.living_room_humidity': { state: '45' }
            }
        };

        shortcut.updateState(mockHass);

        // Cold Temp matches -> color #3b82f6, icon ❄️, value 17.8°
        expect(shortcut.activeState.id).toBe('st_t_cold');
        expect(shortcut.iconText.textContent).toBe('17.8°');
        expect(shortcut.shape.getAttribute('fill')).toBe('#3b82f6');
        expect(shortcut.emojiText.textContent).toBe('❄️');
    });

    it('should display humidity range when input_boolean is off', () => {
        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        
        const mockHass = {
            states: {
                'input_boolean.sensor_living_room': { state: 'off' },
                'sensor.living_room_temperature': { state: '21.4' },
                'sensor.living_room_humidity': { state: '32.1' }
            }
        };

        shortcut.updateState(mockHass);

        // When input_boolean is 'off' and humidity is 32.1, Dry Hum matches -> color #eab308, icon 🌵, value 32.1%
        expect(shortcut.activeState.id).toBe('st_h_dry');
        expect(shortcut.iconText.textContent).toBe('32.1%');
        expect(shortcut.shape.getAttribute('fill')).toBe('#eab308');
        expect(shortcut.emojiText.textContent).toBe('🌵');
    });

    it('should apply desaturation filter and strike-through on unavailable sensor state', () => {
        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        
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

    it('should toggle root helper boolean entity on click', async () => {
        let calledDomain = null;
        let calledService = null;
        let calledPayload = null;

        const customMapContext = {
            _hass: {
                callService: async (domain, service, payload) => {
                    calledDomain = domain;
                    calledService = service;
                    calledPayload = payload;
                }
            },
            imgW: 1000,
            imgH: 1000,
            isRotated: false
        };

        const scDataWithActions = {
            ...scData,
            config: {
                ...scData.config,
                actions: [
                    { type: 'TOGGLE', trigger: 'tap', action_entity: 'input_boolean.sensor_living_room' }
                ]
            }
        };

        const shortcut = new MapShortcut(scDataWithActions, svgNS, 1000, 1000, customMapContext);
        shortcut.updateState({});
        shortcut.onClick({});

        expect(calledDomain).toBe('input_boolean');
        expect(calledService).toBe('toggle');
        expect(calledPayload).toEqual({ entity_id: 'input_boolean.sensor_living_room' });
    });

    it('should evaluate custom value templates supporting math and rounding', () => {
        const customScData = {
            ...scData,
            config: {
                ...scData.config,
                value_template: "{Math.round(get_value('sensor.living_room_temperature')) + 3}°C"
            }
        };
        const shortcut = new MapShortcut(customScData, svgNS, 1000, 1000, mapContext);
        
        const mockHass = {
            states: {
                'input_boolean.sensor_living_room': { state: 'on' },
                'sensor.living_room_temperature': { state: '21.4' }
            }
        };
        shortcut.updateState(mockHass);
        
        // Math.round(21.4) + 3 = 24 -> "24°C"
        expect(shortcut.iconText.textContent).toBe('24°C');
    });

    it('should not emit NaN strike-through line coords when unavailable with orientation-object scale', () => {
        // Regression: the unavailable-line path must resolve {horizontal,vertical} scale
        // objects to a scalar. A default_layout skips the resolver block, so the path
        // reads this.sc.scaleX raw — which used to yield 26 * {object} = NaN.
        const objScaleData = {
            ...scData,
            scale: { horizontal: 3, vertical: 2 },
            scaleX: { horizontal: 3, vertical: 2 },
            scaleY: { horizontal: 3, vertical: 2 },
            config: {
                ...scData.config,
                default_layout: [{ id: 'bg', type: 'rect', width: 10, height: 10, color: '#333' }]
            }
        };
        const shortcut = new MapShortcut(objScaleData, svgNS, 1000, 1000, mapContext);
        shortcut.updateState({ states: { 'input_boolean.sensor_living_room': { state: 'unavailable' } } });

        expect(shortcut.unavailableLine.style.display).toBe('block');
        for (const attr of ['x1', 'y1', 'x2', 'y2']) {
            const v = parseFloat(shortcut.unavailableLine.getAttribute(attr));
            expect(Number.isFinite(v)).toBe(true);
        }
    });
});

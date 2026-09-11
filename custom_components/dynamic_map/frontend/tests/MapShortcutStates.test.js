import { describe, it, expect } from 'vitest';
import { MapShortcut } from '../shortcuts/MapShortcut.js';

describe('MapShortcut availability, rotation and content transforms (JSDOM)', () => {
    it('should correctly calculate auto-rotate status and swap dimensions on rotated maps', () => {
        const scData = {
            id: 'lamp_shortcut_autorotate',
            entity_id: 'light.desk_lamp',
            position: [50, 50],
            config: {
                autoRotate: true,
                states: [
                    {
                        id: 'st_1',
                        name: 'On',
                        state_entity: 'light.desk_lamp',
                        operator: '==',
                        value: 'on',
                        image: '/local/icons/lamp-on.png',
                        autoRotate: false
                    },
                    {
                        id: 'st_2',
                        name: 'Off',
                        state_entity: 'light.desk_lamp',
                        operator: '==',
                        value: 'off',
                        image: '/local/icons/lamp-off.png'
                    }
                ]
            }
        };

        const svgNS = 'http://www.w3.org/2000/svg';
        const mapContext = {
            _hass: {},
            imgW: 1000,
            imgH: 1000,
            isRotated: true
        };

        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.scaleX = 2;
        shortcut.scaleY = 3;

        const mockHassOn = {
            states: {
                'light.desk_lamp': { state: 'on' }
            }
        };

        const mockHassOff = {
            states: {
                'light.desk_lamp': { state: 'off' }
            }
        };

        // 1. When state is "on", autoRotate is overridden to false.
        // It should NOT swap scales even though map is rotated.
        shortcut.updateState(mockHassOn);
        expect(shortcut.getIsAutoRotateActive()).toBe(false);
        expect(shortcut.shape.getAttribute('r')).toBe('24'); // scaleX (2) * 12 = 24

        // 2. When state is "off", autoRotate inherits root true.
        // It should NOT swap scales even when autoRotate is true and map is rotated.
        shortcut.updateState(mockHassOff);
        expect(shortcut.getIsAutoRotateActive()).toBe(true);
        expect(shortcut.shape.getAttribute('r')).toBe('24'); // scaleX (2) * 12 = 24
    });

    it('should desaturate the background and icons, and draw a vibrant red diagonal strike-through if entity is unavailable', () => {
        const scData = {
            id: 'lamp_shortcut_unavailable',
            entity_id: 'light.desk_lamp',
            position: [50, 50],
            config: {
                color: '#facaca',
                icon: '💡'
            }
        };

        const svgNS = 'http://www.w3.org/2000/svg';
        const mapContext = {
            _hass: {},
            imgW: 1000,
            imgH: 1000
        };

        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);

        const mockHassUnavailable = {
            states: {
                'light.desk_lamp': { state: 'unavailable' }
            }
        };

        const mockHassAvailable = {
            states: {
                'light.desk_lamp': { state: 'on' }
            }
        };

        // 1. Initially when the device is unavailable:
        // Grayscale filter should be applied, and red diagonal line should be displayed
        shortcut.updateState(mockHassUnavailable);
        
        const expectedFilter = 'grayscale(100%) opacity(45%)';
        expect(shortcut.bgGroup.style.filter).toBe(expectedFilter);
        expect(shortcut.iconText.style.filter).toBe(expectedFilter);
        expect(shortcut.unavailableLine.style.display).toBe('block');
        
        // Assert coordinates are populated correctly (rx = 12 * 1 = 12)
        // x1/y1 should be -12 * 0.7 = -8.4
        // x2/y2 should be 12 * 0.7 = 8.4
        expect(Number(shortcut.unavailableLine.getAttribute('x1'))).toBeCloseTo(-8.4);
        expect(Number(shortcut.unavailableLine.getAttribute('y1'))).toBeCloseTo(-8.4);
        expect(Number(shortcut.unavailableLine.getAttribute('x2'))).toBeCloseTo(8.4);
        expect(Number(shortcut.unavailableLine.getAttribute('y2'))).toBeCloseTo(8.4);

        // 2. When the device becomes available again:
        // Filters should be cleared, and red line hidden
        shortcut.updateState(mockHassAvailable);
        
        expect(shortcut.bgGroup.style.filter).toBe('');
        expect(shortcut.iconText.style.filter).toBe('');
        expect(shortcut.unavailableLine.style.display).toBe('none');
    });

    it('should use custom availability_entity for unavailable check if specified in config', () => {
        const scData = {
            id: 'lamp_shortcut_custom_avail',
            entity_id: 'light.desk_lamp',
            position: [50, 50],
            config: {
                color: '#facaca',
                icon: '💡',
                availability_entity: 'button.desk_lamp_identify'
            }
        };

        const svgNS = 'http://www.w3.org/2000/svg';
        const mapContext = {
            _hass: {},
            imgW: 1000,
            imgH: 1000
        };

        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);

        const mockHass = {
            states: {
                'light.desk_lamp': { state: 'off' },
                'button.desk_lamp_identify': { state: 'unknown' }
            }
        };

        // Even though light.desk_lamp is 'off', button.desk_lamp_identify is 'unknown',
        // so it should show as unavailable!
        shortcut.updateState(mockHass);

        const expectedFilter = 'grayscale(100%) opacity(45%)';
        expect(shortcut.bgGroup.style.filter).toBe(expectedFilter);
        expect(shortcut.unavailableLine.style.display).toBe('block');

        // Now mock both available
        const mockHassAvailable = {
            states: {
                'light.desk_lamp': { state: 'off' },
                'button.desk_lamp_identify': { state: 'identify' }
            }
        };

        shortcut.updateState(mockHassAvailable);
        expect(shortcut.bgGroup.style.filter).toBe('');
    });

    it('marks a sensor shortcut (no entity_id; entities in config) inaccessible when a source entity is unavailable', () => {
        // Terrace soil sensors etc. carry their entities in config.temperature_entity
        // / humidity_entity and have NO top-level entity_id. They must still show as
        // inaccessible when the physical (battery Zigbee) sensor drops off the mesh.
        const scData = {
            id: 'sensor_shortcut_no_entity_id',
            type: 'sensor',
            position: [50, 50],
            config: {
                icon: '🍅',
                transparent: true,
                temperature_entity: 'sensor.sensor_tomato_1_temperature',
                humidity_entity: 'sensor.sensor_tomato_1_soil_moisture'
            }
        };

        const svgNS = 'http://www.w3.org/2000/svg';
        const mapContext = { _hass: {}, imgW: 1000, imgH: 1000 };
        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);

        // Device offline -> both metrics unavailable -> struck through.
        shortcut.updateState({
            states: {
                'sensor.sensor_tomato_1_temperature': { state: 'unavailable' },
                'sensor.sensor_tomato_1_soil_moisture': { state: 'unavailable' }
            }
        });
        expect(shortcut.bgGroup.style.filter).toBe('grayscale(100%) opacity(45%)');
        expect(shortcut.unavailableLine.style.display).toBe('block');

        // Even one metric dropping (shared radio) flags the device inaccessible.
        shortcut.updateState({
            states: {
                'sensor.sensor_tomato_1_temperature': { state: '24.1' },
                'sensor.sensor_tomato_1_soil_moisture': { state: 'unavailable' }
            }
        });
        expect(shortcut.unavailableLine.style.display).toBe('block');

        // Healthy device -> no strike-through.
        shortcut.updateState({
            states: {
                'sensor.sensor_tomato_1_temperature': { state: '24.1' },
                'sensor.sensor_tomato_1_soil_moisture': { state: '31.4' }
            }
        });
        expect(shortcut.bgGroup.style.filter).toBe('');
        expect(shortcut.unavailableLine.style.display).toBe('none');
    });

    it('should respect custom content offset, scaling and rotation on contentGroup transform', () => {
        const scData = {
            id: 'lamp_shortcut_custom_content',
            entity_id: 'light.desk_lamp',
            position: [50, 50],
            config: {
                content_matchSize: false,
                content_matchRotation: false,
                content_x: 10,
                content_y: -5,
                content_scaleX: 1.5,
                content_scaleY: 0.8,
                content_rotation: 45,
                states: [
                    {
                        name: 'On State',
                        conditions: [
                            { entity: 'light.desk_lamp', value: 'on' }
                        ],
                        content_x: 20,
                        content_rotation: 90
                    }
                ]
            }
        };

        const svgNS = 'http://www.w3.org/2000/svg';
        const mapContext = {
            _hass: {},
            imgW: 1000,
            imgH: 1000,
            isRotated: true
        };

        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        
        // 1. Without active state matching (base config values)
        // Since isRotated is true and autoRotate is false (default is false because config autoRotate is not set to true),
        // let's see: getIsAutoRotateActive resolves to false.
        // So totalContentRotation = -customRot (0) + contentRotation (45) = 45.
        // Transforms should contain: translate(10, -5), rotate(45), scale(1.5, 0.8)
        shortcut.updateState({ states: { 'light.desk_lamp': { state: 'off' } } });
        shortcut.setTransformStr('');
        
        const transformBase = shortcut.contentGroup.getAttribute('transform');
        expect(transformBase).toContain('translate(10, -5)');
        expect(transformBase).toContain('rotate(45)');
        expect(transformBase).toContain('scale(1.5, 0.8)');

        // 2. With matched state ('on' state active)
        // matchedState overrides content_x to 20, content_rotation to 90.
        // scaleX/scaleY fall back to base config (1.5, 0.8)
        // Transforms should contain: translate(20, -5), rotate(90), scale(1.5, 0.8)
        shortcut.updateState({ states: { 'light.desk_lamp': { state: 'on' } } });
        shortcut.setTransformStr('');
        
        const transformMatched = shortcut.contentGroup.getAttribute('transform');
        expect(transformMatched).toContain('translate(20, -5)');
        expect(transformMatched).toContain('rotate(90)');
        expect(transformMatched).toContain('scale(1.5, 0.8)');
    });
});

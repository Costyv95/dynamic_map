import { describe, it, expect } from 'vitest';
import { MapShortcut } from '../shortcuts/MapShortcut.js';

describe('MapShortcut rendering (JSDOM)', () => {
    it('should initialize and handle native SVG tag load and error states correctly', async () => {
        const scData = {
            id: 'lamp_shortcut',
            entity_id: 'light.desk_lamp',
            position: [50, 50],
            config: {
                states: [
                    {
                        id: 'st_1',
                        name: 'On',
                        state_entity: 'light.desk_lamp',
                        operator: '==',
                        value: 'on',
                        color: '#facaca',
                        image: '/local/icons/lamp-on.png'
                    },
                    {
                        id: 'st_2',
                        name: 'Off',
                        state_entity: 'light.desk_lamp',
                        operator: '==',
                        value: 'off',
                        color: '#a17070',
                        image: '/local/icons/lamp-off.png'
                    }
                ]
            }
        };

        const svgNS = 'http://www.w3.org/2000/svg';
        const mapContext = {
            _hass: {},
            imgW: 1000,
            imgH: 1000
        };

        // Instantiate MapShortcut
        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        
        // Render SVG elements
        shortcut.updateState({ states: { 'light.desk_lamp': { state: 'off' } } });

        // 1. Initial State: lamp is "off" (fallback icon should show while loading natively)
        const mockHass = {
            states: {
                'light.desk_lamp': { state: 'off' }
            }
        };

        shortcut.updateState(mockHass);

        // Verify shape color and fallback icon since native load has not resolved yet
        expect(shortcut.shape.getAttribute('fill')).toBe('#a17070');
        expect(shortcut.iconImage.style.opacity).toBe('0');
        expect(shortcut.iconText.textContent).toBe(''); // no fallback icon during loading
        expect(shortcut.iconImage.getAttribute('href')).toBe('/local/icons/lamp-off.png');

        // 2. Resolve the native load for Off state by dispatching standard load event
        shortcut.iconImage.dispatchEvent(new window.Event('load'));

        // Wait for microtasks/promises to resolve
        await new Promise(resolve => setTimeout(resolve, 0));

        // Check if image display updated to opacity 1 and received correct attributes
        expect(shortcut.iconImage.style.opacity).toBe('1');
        expect(shortcut.iconImage.getAttribute('href')).toBe('/local/icons/lamp-off.png');
        expect(shortcut.iconImage.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('/local/icons/lamp-off.png');
        expect(shortcut.iconText.textContent).toBe('');

        // 3. Switch to On state
        const mockHassOn = {
            states: {
                'light.desk_lamp': { state: 'on' }
            }
        };

        shortcut.updateState(mockHassOn);

        // Assert color changed, but image hidden initially because it's loading natively
        expect(shortcut.shape.getAttribute('fill')).toBe('#facaca');
        expect(shortcut.iconImage.style.opacity).toBe('0');
        expect(shortcut.iconText.textContent).toBe(''); // no fallback icon during loading
        expect(shortcut.iconImage.getAttribute('href')).toBe('/local/icons/lamp-on.png');

        // 4. Fail the native load for On state (by dispatching error event)
        shortcut.iconImage.dispatchEvent(new window.Event('error'));

        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert SVG remains hidden and fallback icon is drawn
        expect(shortcut.iconImage.style.opacity).toBe('0');
        expect(shortcut.iconText.textContent).toBe('💡');

        // 5. Subsequent updates when image already failed should load fallback immediately
        shortcut.updateState(mockHassOn);
        expect(shortcut.iconImage.style.opacity).toBe('0');
        expect(shortcut.iconText.textContent).toBe('💡');

        // 6. Simulate time passing past the 15-second cooldown (e.g. 20 seconds later)
        const originalDateNow = Date.now;
        Date.now = () => originalDateNow() + 20000;

        try {
            // Update state again - should retry loading since cooldown passed
            shortcut.updateState(mockHassOn);

            expect(shortcut.iconImage.getAttribute('href')).toBe('/local/icons/lamp-on.png');
            expect(shortcut.iconImage.style.opacity).toBe('0'); // Still placeholder until loaded

            // Dispatch load event successfully
            shortcut.iconImage.dispatchEvent(new window.Event('load'));

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Verify that the image is now successfully showing on the SVG!
            expect(shortcut.iconImage.style.opacity).toBe('1');
            expect(shortcut.iconImage.getAttribute('href')).toBe('/local/icons/lamp-on.png');
            expect(shortcut.iconText.textContent).toBe('');
        } finally {
            // Restore Date.now to prevent side effects in other tests
            Date.now = originalDateNow;
        }
    });

    it('should render correct fill, stroke, and fallback color when transparent is enabled/disabled', async () => {
        const scData = {
            id: 'lamp_shortcut_trans',
            entity_id: 'light.desk_lamp_trans',
            position: [50, 50],
            config: {
                color: '#facaca',
                icon: '💡',
                transparent: true
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
                'light.desk_lamp_trans': { state: 'off' }
            }
        };

        // 1. With transparent = true
        shortcut.updateState(mockHass);
        expect(shortcut.shape.getAttribute('fill')).toBe('rgba(0,0,0,0)');
        expect(shortcut.shape.getAttribute('stroke')).toBe('rgba(0,0,0,0)');
        expect(shortcut.iconText.getAttribute('fill')).toBe('#facaca');
        expect(['rgb(250, 202, 202)', '#facaca']).toContain(shortcut.haIcon.style.color);

        // 2. With transparent = false — #facaca is a light background, so the
        // icon gets the contrast-aware dark color instead of classic white.
        shortcut.config.transparent = false;
        shortcut.updateState(mockHass);
        expect(shortcut.shape.getAttribute('fill')).toBe('#facaca');
        expect(shortcut.shape.getAttribute('stroke')).toBe('white');
        expect(shortcut.iconText.getAttribute('fill')).toBe('#1e293b');
        expect(shortcut.haIcon.style.color).toBe('#1e293b');
    });

});

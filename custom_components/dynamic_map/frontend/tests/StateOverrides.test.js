import { describe, it, expect } from 'vitest';

function resolveShortcutAssets(sc, activeState = null, previewStateIdx = -1) {
    let color = sc.config?.color || sc.color || '#0ea5e9';
    let icon = sc.config?.icon || '💡';
    let image = sc.config?.image || '';

    let activeStateObj = activeState;
    if (previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
        activeStateObj = sc.config.states[previewStateIdx];
    }

    if (activeStateObj) {
        if (activeStateObj.color) color = activeStateObj.color;
        if (activeStateObj.image) {
            image = activeStateObj.image;
            icon = activeStateObj.icon || '';
        } else if (activeStateObj.icon) {
            icon = activeStateObj.icon;
            image = '';
        }
    }

    const finalImage = image || (icon && (icon.startsWith('http') || icon.startsWith('/') || icon.endsWith('.png') || icon.endsWith('.svg') || icon.endsWith('.jpg') || icon.endsWith('.webp')) ? icon : '');

    const isUrlFn = (str) => str && (str.startsWith('http') || str.startsWith('/') || str.endsWith('.png') || str.endsWith('.svg') || str.endsWith('.jpg') || str.endsWith('.webp'));
    let fallbackIcon = '💡';
    if (activeStateObj && activeStateObj.icon && !isUrlFn(activeStateObj.icon)) {
        fallbackIcon = activeStateObj.icon;
    } else if (sc.config?.icon && !isUrlFn(sc.config.icon)) {
        fallbackIcon = sc.config.icon;
    } else if (sc.icon && !isUrlFn(sc.icon)) {
        fallbackIcon = sc.icon;
    }

    return { color, icon, image, finalImage, fallbackIcon };
}

describe('State Overrides Priority', () => {
    it('should fall back to base image if state has no override', () => {
        const sc = {
            config: {
                image: '/local/off.png',
                icon: '💡',
                states: [
                    { name: 'Off State', value: 'off' }
                ]
            }
        };

        const res = resolveShortcutAssets(sc, null, 0);
        expect(res.image).toBe('/local/off.png');
        expect(res.icon).toBe('💡');
        expect(res.finalImage).toBe('/local/off.png');
    });

    it('should override with state image and clear base icon', () => {
        const sc = {
            config: {
                image: '/local/off.png',
                icon: '💡',
                states: [
                    { name: 'On State', value: 'on', image: '/local/on.png' }
                ]
            }
        };

        const res = resolveShortcutAssets(sc, null, 0);
        expect(res.image).toBe('/local/on.png');
        expect(res.icon).toBe('');
        expect(res.finalImage).toBe('/local/on.png');
    });

    it('should override with state icon and clear base image if state icon is a URL/PNG', () => {
        const sc = {
            config: {
                image: '/local/off.png',
                icon: '💡',
                states: [
                    { name: 'On State', value: 'on', icon: '/local/on.png' }
                ]
            }
        };

        const res = resolveShortcutAssets(sc, null, 0);
        expect(res.image).toBe('');
        expect(res.icon).toBe('/local/on.png');
        expect(res.finalImage).toBe('/local/on.png');
    });

    it('should keep base values if state defines nothing', () => {
        const sc = {
            config: {
                image: '/local/off.png',
                icon: '💡',
                states: [
                    { name: 'State with no icon/image', value: 'some_value' }
                ]
            }
        };

        const res = resolveShortcutAssets(sc, null, 0);
        expect(res.image).toBe('/local/off.png');
        expect(res.icon).toBe('💡');
        expect(res.finalImage).toBe('/local/off.png');
    });

    it('should resolve state icon as fallbackIcon if it is not a URL', () => {
        const sc = {
            config: {
                icon: '💡',
                states: [
                    { name: 'State with icon', value: 'on', image: '/local/on.png', icon: '🔥' }
                ]
            }
        };

        const res = resolveShortcutAssets(sc, null, 0);
        expect(res.finalImage).toBe('/local/on.png');
        expect(res.icon).toBe('🔥');
        expect(res.fallbackIcon).toBe('🔥');
    });

    it('should resolve base icon as fallbackIcon if state icon is missing/URL and base icon is not a URL', () => {
        const sc = {
            config: {
                icon: '⚡',
                states: [
                    { name: 'State with image only', value: 'on', image: '/local/on.png' }
                ]
            }
        };

        const res = resolveShortcutAssets(sc, null, 0);
        expect(res.finalImage).toBe('/local/on.png');
        expect(res.icon).toBe('');
        expect(res.fallbackIcon).toBe('⚡');
    });

    it('should fall back to 💡 if both state icon and base icon are missing or URLs', () => {
        const sc = {
            config: {
                icon: '/local/base.png',
                states: [
                    { name: 'State with image only', value: 'on', image: '/local/on.png' }
                ]
            }
        };

        const res = resolveShortcutAssets(sc, null, 0);
        expect(res.finalImage).toBe('/local/on.png');
        expect(res.icon).toBe('');
        expect(res.fallbackIcon).toBe('💡');
    });
});

import { GenericShortcut } from '../shortcuts/GenericShortcut.js';

describe('GenericShortcut JSDOM Integration', () => {
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

        // Instantiate GenericShortcut
        const shortcut = new GenericShortcut(scData, svgNS, 1000, 1000, mapContext);
        
        // Render SVG elements
        shortcut.render();

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
        expect(shortcut.iconText.textContent).toBe('💡'); // fallback icon
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
        expect(shortcut.iconText.textContent).toBe('💡');
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

        const shortcut = new GenericShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.render();

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

        // 2. With transparent = false
        shortcut.config.transparent = false;
        shortcut.updateState(mockHass);
        expect(shortcut.shape.getAttribute('fill')).toBe('#facaca');
        expect(shortcut.shape.getAttribute('stroke')).toBe('white');
        expect(shortcut.iconText.getAttribute('fill')).toBe('white');
        expect(shortcut.haIcon.style.color).toBe('white');
    });

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

        const shortcut = new GenericShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.scaleX = 2;
        shortcut.scaleY = 3;
        shortcut.render();

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
        // It SHOULD swap scales because autoRotate is true and map is rotated.
        // ActiveScaleX becomes scaleY (3), activeScaleY becomes scaleX (2).
        shortcut.updateState(mockHassOff);
        expect(shortcut.getIsAutoRotateActive()).toBe(true);
        expect(shortcut.shape.getAttribute('r')).toBe('36'); // scaleY (3) * 12 = 36
    });
});



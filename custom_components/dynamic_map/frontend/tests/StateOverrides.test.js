import { describe, it, expect } from 'vitest';

function resolveShortcutAssets(sc, activeState = null, previewStateIdx = -1) {
    let color = sc.config?.color || sc.color || '#0ea5e9';
    let icon = sc.config?.icon || '💡';
    let image = sc.config?.image || '';

    // Active state override logic (as in GenericShortcut.js and CanvasEngine.js)
    let activeStateObj = activeState;
    if (previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
        activeStateObj = sc.config.states[previewStateIdx];
    }

    if (activeStateObj) {
        if (activeStateObj.color) color = activeStateObj.color;
        if (activeStateObj.image !== undefined && activeStateObj.image !== '') {
            image = activeStateObj.image;
            icon = '';
        } else if (activeStateObj.icon !== undefined && activeStateObj.icon !== '') {
            icon = activeStateObj.icon;
            image = '';
        } else {
            if (activeStateObj.icon) icon = activeStateObj.icon;
            if (activeStateObj.image) image = activeStateObj.image;
        }
    }

    const finalImage = image || (icon && (icon.startsWith('http') || icon.startsWith('/') || icon.endsWith('.png') || icon.endsWith('.svg') || icon.endsWith('.jpg') || icon.endsWith('.webp')) ? icon : '');

    return { color, icon, image, finalImage };
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
});

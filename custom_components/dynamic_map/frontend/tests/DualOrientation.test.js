import { describe, it, expect } from 'vitest';
import { MapShortcut } from '../shortcuts/MapShortcut.js';

describe('MapShortcut Dual Orientation Positioning', () => {
    const scData = {
        id: 'light_sc_123',
        entity_id: 'light.test_lamp',
        position: {
            horizontal: [10, 20],
            vertical: [45, 90]
        },
        type: 'light',
        config: {
            shape: 'circle',
            color: '#facaca'
        }
    };

    const svgNS = 'http://www.w3.org/2000/svg';

    it('should place element at horizontal coordinates when activeMode is horizontal', () => {
        const mapContext = {
            activeMode: 'horizontal',
            imgW: 1000,
            imgH: 1000
        };
        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.updateState({}); // updates coordinates

        // px = (10 / 100) * 1000 = 100
        // py = (20 / 100) * 1000 = 200
        expect(shortcut.px).toBe(100);
        expect(shortcut.py).toBe(200);
        expect(shortcut.group.getAttribute('transform')).toBe('translate(100, 200)');
    });

    it('should place element at vertical coordinates when activeMode is vertical', () => {
        const mapContext = {
            activeMode: 'vertical',
            imgW: 1000,
            imgH: 1000
        };
        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.updateState({}); // updates coordinates

        // px = (45 / 100) * 1000 = 450
        // py = (90 / 100) * 1000 = 900
        expect(shortcut.px).toBe(450);
        expect(shortcut.py).toBe(900);
        expect(shortcut.group.getAttribute('transform')).toBe('translate(450, 900)');
    });

    it('should fallback gracefully to horizontal coordinates if vertical is missing', () => {
        const legacyScData = {
            id: 'light_sc_legacy',
            position: [15, 30],
            type: 'light',
            config: { shape: 'circle' }
        };
        const mapContext = {
            activeMode: 'vertical',
            imgW: 1000,
            imgH: 1000
        };
        const shortcut = new MapShortcut(legacyScData, svgNS, 1000, 1000, mapContext);
        shortcut.updateState({});

        expect(shortcut.px).toBe(150);
        expect(shortcut.py).toBe(300);
    });

    it('should dynamically update positions when activeMode switches and updateCoordinates is called', () => {
        const mapContext = {
            activeMode: 'horizontal',
            imgW: 1000,
            imgH: 1000
        };
        const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
        shortcut.updateState({});

        expect(shortcut.px).toBe(100);
        expect(shortcut.py).toBe(200);

        // Dynamically change activeMode on mapContext
        mapContext.activeMode = 'vertical';
        shortcut.updateCoordinates();

        expect(shortcut.px).toBe(450);
        expect(shortcut.py).toBe(900);
        expect(shortcut.group.getAttribute('transform')).toBe('translate(450, 900)');
    });
});

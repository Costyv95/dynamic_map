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

    describe('Sensor Sizing and Element Scaling', () => {
        it('should scale the background rect and position child nodes using scaleX and scaleY', () => {
            const sensorScData = {
                id: 'sensor_test_1',
                entity_id: 'sensor.test',
                position: [20, 30],
                type: 'sensor',
                scaleX: 2.0,
                scaleY: 3.0,
                config: {
                    color: '#10b981',
                    icon: '🌡️'
                }
            };
            const mapContext = {
                activeMode: 'horizontal',
                imgW: 1000,
                imgH: 1000
            };
            const shortcut = new MapShortcut(sensorScData, svgNS, 1000, 1000, mapContext);
            shortcut.updateState({});

            const bgRect = shortcut.group.querySelector('#sensor_bg');
            expect(bgRect).toBeDefined();
            // Height: 24 * scaleY = 24 * 3 = 72; rx/ry: 8 * Math.min(2, 3) = 16.
            // Width is auto-sized to the icon + value content.
            expect(bgRect.getAttribute('height')).toBe('72');
            expect(bgRect.getAttribute('rx')).toBe('16');
            expect(parseFloat(bgRect.getAttribute('width'))).toBeGreaterThan(0);

            const emojiEl = shortcut.group.querySelector('#sensor_emoji');
            expect(emojiEl).toBeDefined();
            expect(emojiEl.getAttribute('font-size')).toBe('28'); // 14 * min(2,3) = 28

            // Flow layout: value text is start-anchored to the right of the
            // center-anchored icon slot, so the two can never overlap.
            const valueEl = shortcut.group.querySelector('#sensor_value');
            expect(valueEl.getAttribute('text-anchor')).toBe('start');
            const emojiX = parseFloat(emojiEl.getAttribute('x'));
            const valueX = parseFloat(valueEl.getAttribute('x'));
            const iconHalfW = parseFloat(emojiEl.getAttribute('font-size')) * 1.1 / 2;
            expect(valueX).toBeGreaterThanOrEqual(emojiX + iconHalfW);

            // Pill spans both texts: left edge before the icon, right edge
            // beyond where the value text starts.
            const bgLeft = -parseFloat(bgRect.getAttribute('width')) / 2;
            expect(emojiX - iconHalfW).toBeGreaterThanOrEqual(bgLeft);
            expect(bgLeft + parseFloat(bgRect.getAttribute('width'))).toBeGreaterThan(valueX);
        });
    });

    describe('SVG Image Load State Lifecycle & Opacity Transitions', () => {
        it('should follow load lifecycle, setting state loaded and opacity 1 on load event', () => {
            const imageScData = {
                id: 'img_test_1',
                position: [50, 50],
                type: 'light',
                config: {
                    shape: 'circle',
                    image: '/local/icons/flamingo-on.png'
                }
            };
            const mapContext = {
                activeMode: 'horizontal',
                imgW: 1000,
                imgH: 1000
            };
            const shortcut = new MapShortcut(imageScData, svgNS, 1000, 1000, mapContext);
            shortcut.updateState({});

            const imgEl = shortcut.group.querySelector('#fallback_image');
            expect(imgEl).toBeDefined();
            // Initially should have opacity set to 0 during loading phase
            expect(imgEl.style.opacity).toBe('0');

            // Dispatch load event on image
            const loadEvent = new window.Event('load');
            imgEl.dispatchEvent(loadEvent);

            // After load finishes, opacity should transition to 1
            expect(imgEl.style.opacity).toBe('1');
            expect(shortcut._imageLoadStates['/local/icons/flamingo-on.png'].status).toBe('loaded');
        });
    });
});

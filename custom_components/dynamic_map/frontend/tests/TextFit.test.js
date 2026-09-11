import { describe, it, expect } from 'vitest';
import { layoutRoomLabel, splitName, applyRoomLabel, roomBox } from '../core/RoomLabels.js';
import { visualMenuBox } from '../card/OverlayManager.js';
import { MapShortcut } from '../shortcuts/MapShortcut.js';
import { estimateTextWidth } from '../shared/SensorPill.js';

const svgNS = 'http://www.w3.org/2000/svg';

describe('room labels fit their room', () => {
    it('keeps the base size when the name fits', () => {
        expect(layoutRoomLabel('Office', 400, 300, 17)).toEqual({ fontSize: 17, lines: ['Office'] });
    });

    it('shrinks a long single word', () => {
        const r = layoutRoomLabel('Wintergarten', 90, 200, 17);
        expect(r.lines).toEqual(['Wintergarten']);
        expect(r.fontSize).toBeLessThan(17);
        expect(r.fontSize).toBeGreaterThanOrEqual(17 * 0.45);
    });

    it('splits a two-word name into two lines when the room is narrow and tall enough', () => {
        const r = layoutRoomLabel('Stairs Terrace', 91, 120, 17);
        expect(r.lines).toEqual(['Stairs', 'Terrace']);
        expect(r.fontSize).toBeGreaterThan(layoutRoomLabel('Stairs Terrace', 91, 20, 17).fontSize);
    });

    it('splits on the space nearest the middle', () => {
        expect(splitName('Master bedroom closet')).toEqual(['Master bedroom', 'closet']);
        expect(splitName('Kitchen')).toBeNull();
    });

    it('applyRoomLabel writes tspans for two lines and plain text for one', () => {
        const t = document.createElementNS(svgNS, 'text');
        applyRoomLabel(t, 'Stairs Terrace', 91, 120, 17, 50, 60, svgNS);
        expect(t.querySelectorAll('tspan').length).toBe(2);
        applyRoomLabel(t, 'Office', 400, 300, 17, 50, 60, svgNS);
        expect(t.querySelectorAll('tspan').length).toBe(0);
        expect(t.textContent).toBe('Office');
    });

    it('roomBox measures the polygon in map pixels', () => {
        expect(roomBox({ polygon: [[10, 10], [30, 10], [30, 50]] }, 1000, 500)).toEqual({ cx: 200, cy: 150, w: 200, h: 200 });
    });
});

describe('visual menu sizing', () => {
    it('grows the saved menu size to contain every placed item', () => {
        const cfg = { menuWidth: 200, menuHeight: 100 };
        expect(visualMenuBox(cfg, [{ pos_x: 10, pos_y: 10, width: '180', height: 35 }])).toEqual({ w: 200, h: 100 });
        expect(visualMenuBox(cfg, [{ pos_x: 150, pos_y: 120, width: 100, height: 40 }])).toEqual({ w: 258, h: 168 });
        expect(visualMenuBox({}, [{ trigger: 'long_press' }])).toEqual({ w: 200, h: 250 });
    });
});

describe('sensor pill width follows the rendered text', () => {
    const make = () => new MapShortcut({ id: 'p', type: 'sensor', entity_id: 'sensor.t', position: [50, 50], config: {} }, svgNS, 1000, 1000, { activeMode: 'horizontal' });

    it('falls back to the estimate when the badge is not mounted', () => {
        const sc = make();
        expect(sc.measureText('21.4°', 12)).toBeCloseTo(estimateTextWidth('21.4°', 12), 6);
    });

    it('uses getComputedTextLength once mounted and widens the pill accordingly', () => {
        const sc = make();
        const svg = document.createElementNS(svgNS, 'svg');
        document.body.appendChild(svg);
        svg.appendChild(sc.render());
        const hass = { states: { 'sensor.t': { state: '21.4' } } };
        sc.updateState(hass);
        const estimated = parseFloat(sc.shape.getAttribute('width'));
        // Pretend the real font renders the value much wider than the estimate.
        sc._measureEl.getComputedTextLength = () => 80;
        sc.invalidate();
        sc.updateState(hass);
        expect(parseFloat(sc.shape.getAttribute('width'))).toBeGreaterThan(estimated + 40);
        svg.remove();
    });
});

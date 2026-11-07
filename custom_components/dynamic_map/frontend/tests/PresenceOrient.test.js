import { describe, it, expect } from 'vitest';
import { buildPresenceLayer, orientPresence, screenDown } from '../card/PresenceLayer.js';

const svgNS = 'http://www.w3.org/2000/svg';
const hass = { states: { 'sensor.costi_room': { state: 'Office', attributes: {} } }, areas: {} };

function host({ isRotated = false, mapScaleX = 1, mapScaleY = 1 } = {}) {
    return {
        svgNS, imgW: 1000, imgH: 1000, activeFloor: 1, isRotated, mapScaleX, mapScaleY,
        config: { presence: [{ entity: 'sensor.costi_room', name: 'Costi' }] },
        mapRoot: document.createElementNS(svgNS, 'g'),
        rooms: [{ id: 'r1', name: 'Office', polygon: [[40, 40], [60, 40], [60, 60], [40, 60]] }],
        _hass: hass,
    };
}
const dot = h => h._presenceDots[0];

describe('presence initials under a rotated plan (#2507)', () => {
    it('read upright: the letter turns back as the room labels do', () => {
        const h = host({ isRotated: true });
        buildPresenceLayer(h);
        expect(dot(h).label.textContent).toBe('C');
        expect(dot(h).label.getAttribute('transform')).toBe('rotate(-90)');
    });
    it('undo the flips too, and drop the turn when the plan is upright again', () => {
        const h = host({ isRotated: true, mapScaleX: -1 });
        buildPresenceLayer(h);
        expect(dot(h).label.getAttribute('transform')).toBe('scale(-1, 1) rotate(-90)');
        Object.assign(h, { isRotated: false, mapScaleX: 1 });
        orientPresence(h);
        expect(dot(h).label.hasAttribute('transform')).toBe(false);
    });
});

describe('a dot in a room sits under its label, not on it (#2507)', () => {
    it('upright: below the room centre', () => {
        const h = host();
        buildPresenceLayer(h);
        expect([dot(h).tx, dot(h).ty]).toEqual([500, 536]);
    });
    it('rotated: the step goes along image x, which shows as down', () => {
        const h = host({ isRotated: true });
        buildPresenceLayer(h);
        expect([dot(h).tx, dot(h).ty]).toEqual([536, 500]);
        expect(screenDown(h, 10)).toEqual([10, 0]);
    });
    it('re-placed at once when the viewport turns', () => {
        const h = host();
        buildPresenceLayer(h);
        h.isRotated = true;
        orientPresence(h);
        expect([dot(h).curX, dot(h).curY]).toEqual([536, 500]);
    });
});

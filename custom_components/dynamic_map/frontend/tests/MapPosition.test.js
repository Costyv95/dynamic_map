import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../custom-svg-map.js';
import { spotForState } from '../card/PresenceLayer.js';
import { buildCalibrate, toMapPercent } from '../card/Calibrate.js';

const svgNS = 'http://www.w3.org/2000/svg';

function makeCard(config = {}) {
    const card = document.createElement('custom-svg-map');
    card.config = { ...config };
    card.imgW = 1000;
    card.imgH = 1000;
    card.activeFloor = 2;
    card.mapRoot = document.createElementNS(svgNS, 'g');
    card.rooms = [
        { id: 'r1', name: 'Office', polygon: [[10, 10], [30, 10], [30, 30], [10, 30]] },
        { id: 'r2', name: 'Bedroom', polygon: [[50, 50], [90, 50], [90, 90], [50, 90]] },
    ];
    return card;
}

const pos = (attrs, state = 'Office') => ({ state, attributes: attrs });

describe('map-position dots (#1354)', () => {
    beforeEach(() => { global.requestAnimationFrame = vi.fn(); global.cancelAnimationFrame = vi.fn(); });

    it('a calibrated spot puts the dot exactly there, on its floor only', () => {
        const card = makeCard({ presence: [{ entity: 'sensor.p' }] });
        card.buildPresenceLayer();
        card.updatePresence({ states: { 'sensor.p': pos({ floor: 2, x: 12.5, y: 27, source: 'fingerprint' }) } });
        const dot = card._presenceDots[0];
        expect(dot.visible).toBe(true);
        expect([dot.tx, dot.ty]).toEqual([125, 270]);

        card.updatePresence({ states: { 'sensor.p': pos({ floor: 3, x: 12.5, y: 27, source: 'fingerprint' }) } });
        expect(dot.visible).toBe(false);
    });

    it('a room-centre guess goes the room way, so two people in one room sit side by side', () => {
        expect(spotForState(pos({ floor: 2, x: 20, y: 20, source: 'room' }), 2)).toBe(null);
        const card = makeCard({ presence: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }] });
        card.buildPresenceLayer();
        const guess = pos({ floor: 2, x: 20, y: 20, source: 'room' });
        card.updatePresence({ states: { 'sensor.a': guess, 'sensor.b': guess } });
        const [a, b] = card._presenceDots;
        expect(a.visible && b.visible).toBe(true);
        expect(a.tx).not.toBe(b.tx);
    });

    it('a plain Bermuda area sensor still works (no x/y)', () => {
        expect(spotForState({ state: 'Office', attributes: {} }, 2)).toBe(null);
        expect(spotForState(pos({ floor: 2, x: 'nope', y: 1 }), 2)).toBe(null);
    });
});

describe('calibrate button', () => {
    const host = (user, extra = {}) => {
        const card = makeCard(extra);
        card.topLeftUI = document.createElement('div');
        card._hass = { user, callWS: vi.fn(), callApi: vi.fn() };
        return card;
    };

    it('is offered to admins only, and can be switched off', () => {
        const admin = host({ is_admin: true });
        buildCalibrate(admin);
        expect(admin.topLeftUI.querySelector('.dm-calib-btn')).not.toBe(null);

        const guest = host({ is_admin: false });
        buildCalibrate(guest);
        expect(guest.topLeftUI.querySelector('.dm-calib-btn')).toBe(null);

        const off = host({ is_admin: true }, { calibrate: false });
        buildCalibrate(off);
        expect(off.topLeftUI.querySelector('.dm-calib-btn')).toBe(null);
    });

    it('turns a screen point into map percent through the map transform, null off the floor', () => {
        const card = makeCard();
        const inv = { a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0 };
        card.mapRoot.getScreenCTM = () => ({ inverse: () => inv });
        global.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform(m) { return { x: this.x * m.a + m.e, y: this.y * m.d + m.f }; } };
        expect(toMapPercent(card, 400, 1000)).toEqual({ x: 20, y: 50 });
        expect(toMapPercent(card, 4000, 10)).toBe(null);
    });
});

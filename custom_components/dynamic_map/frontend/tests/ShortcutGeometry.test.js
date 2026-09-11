import { describe, it, expect } from 'vitest';
import {
    shortcutFrame, writeFrame, toLocal, fromLocal, hitsFrame,
    screenRotation, badgeTransform, shortcutShape, isUpright, BASE_SIZE
} from '../shared/ShortcutGeometry.js';

const IMG = { imgW: 1000, imgH: 500 };

function badge(extra = {}) {
    return { id: 'a', type: 'generic', position: [50, 50], config: { shape: 'rect', proportional: false }, ...extra };
}

describe('shortcutFrame', () => {
    it('places a default badge at the position in map pixels, 24 units square', () => {
        const f = shortcutFrame({ id: 'a', position: [10, 20] }, IMG);
        expect(f).toMatchObject({ x: 100, y: 100, w: BASE_SIZE, h: BASE_SIZE, rotation: 0, upright: true, shape: 'circle' });
    });

    it('scales width and height from scaleX / scaleY', () => {
        const f = shortcutFrame(badge({ scaleX: 2, scaleY: 3 }), IMG);
        expect(f.w).toBe(48);
        expect(f.h).toBe(72);
    });

    it('uses the orientation leg that matches mode', () => {
        const sc = badge({ scaleX: { horizontal: 2, vertical: 4 }, position: { horizontal: [10, 10], vertical: [90, 90] } });
        expect(shortcutFrame(sc, { ...IMG, mode: 'horizontal' })).toMatchObject({ x: 100, w: 48 });
        expect(shortcutFrame(sc, { ...IMG, mode: 'vertical' })).toMatchObject({ x: 900, w: 96 });
    });

    it('lets a state override size and rotation but never position', () => {
        const st = { scaleX: 5, rotation: 45, position: [0, 0] };
        const f = shortcutFrame(badge({ rotation: 10 }), { ...IMG, state: st });
        expect(f.w).toBe(120);
        expect(f.rotation).toBe(45);
        expect(f.x).toBe(500);
    });

    it('keeps proportional circles square even with a different scaleY', () => {
        const f = shortcutFrame({ position: [50, 50], scaleX: 2, scaleY: 9, config: { shape: 'circle' } }, IMG);
        expect(f.w).toBe(f.h);
        expect(f.proportional).toBe(true);
    });

    it('sizes sensors from the pill text, with a rect shape', () => {
        const sc = { type: 'sensor', position: [50, 50], entity_id: 'sensor.t', config: {} };
        const f = shortcutFrame(sc, { ...IMG, hass: { states: { 'sensor.t': { state: '21.5' } } } });
        expect(f.shape).toBe('rect');
        expect(f.h).toBe(24);
        expect(f.w).toBeGreaterThan(24);
    });

    it('reads autoRotate from the state, then config', () => {
        expect(isUpright(badge({ config: { autoRotate: true } }))).toBe(false);
        expect(isUpright(badge({ config: { autoRotate: true } }), { autoRotate: false })).toBe(true);
        expect(shortcutShape(badge(), { shape: 'circle' })).toBe('circle');
    });
});

describe('writeFrame', () => {
    it('writes a position to both legs when linked', () => {
        const sc = badge();
        writeFrame(sc, { x: 250, y: 125 }, IMG);
        expect(sc.position).toEqual({ horizontal: [25, 25], vertical: [25, 25] });
    });

    it('writes only the active leg when unlinked', () => {
        const sc = badge();
        writeFrame(sc, { x: 250 }, { ...IMG, mode: 'vertical' });
        expect(sc.position.vertical).toEqual([25, 50]);
        expect(sc.position.horizontal).toEqual([50, 50]);
    });

    it('converts width and height into scales and clamps at 0.5', () => {
        const sc = badge();
        writeFrame(sc, { w: 48, h: 6 }, IMG);
        expect(shortcutFrame(sc, IMG)).toMatchObject({ w: 48, h: 12 });
    });

    it('writes size and rotation into the state when one is given, position into the shortcut', () => {
        const sc = badge();
        const st = {};
        writeFrame(sc, { w: 72, rotation: 30, x: 100 }, { ...IMG, state: st });
        expect(st.scaleX).toEqual({ horizontal: 3, vertical: 3 });
        expect(st.rotation).toEqual({ horizontal: 30, vertical: 30 });
        expect(st.position).toBeUndefined();
        expect(sc.position.horizontal[0]).toBe(10);
    });

    it('keeps a sensor pill height-driven: width maps to scaleX against the unscaled pill', () => {
        const sc = { type: 'sensor', position: [50, 50], entity_id: 'sensor.t', config: {} };
        const before = shortcutFrame(sc, IMG);
        writeFrame(sc, { w: before.w * 2 }, IMG);
        expect(shortcutFrame(sc, IMG).w).toBeCloseTo(before.w * 2, 5);
    });
});

describe('local frame math', () => {
    const frame = { x: 100, y: 100, w: 40, h: 20, rotation: 90, upright: true, shape: 'rect' };

    it('toLocal / fromLocal round-trip with rotation and an upright counter-rotation', () => {
        const p = fromLocal(frame, 15, -5, true);
        const l = toLocal(frame, p.x, p.y, true);
        expect(l.x).toBeCloseTo(15, 6);
        expect(l.y).toBeCloseTo(-5, 6);
    });

    it('rotates the local +x axis onto screen down at rotation 90', () => {
        const p = fromLocal(frame, 10, 0, false);
        expect(p.x).toBeCloseTo(100, 6);
        expect(p.y).toBeCloseTo(110, 6);
    });

    it('hit-tests rects in the rotated frame and ellipses by radius', () => {
        expect(hitsFrame(frame, 100, 118)).toBe(true);   // along rotated long axis
        expect(hitsFrame(frame, 118, 100)).toBe(false);  // across the short axis
        const circle = { x: 0, y: 0, w: 20, h: 20, rotation: 0, upright: true, shape: 'circle' };
        expect(hitsFrame(circle, 7, 7)).toBe(true);
        expect(hitsFrame(circle, 9, 9)).toBe(false);
    });

    it('screenRotation and badgeTransform fold in the upright counter-rotation', () => {
        expect(screenRotation(frame, true)).toBe(0);
        expect(screenRotation({ ...frame, upright: false }, true)).toBe(90);
        expect(badgeTransform(frame, { isRotated: true, flipX: -1 })).toBe('translate(100, 100) rotate(90) scale(-1, 1) rotate(-90)');
        expect(badgeTransform({ ...frame, rotation: 0 })).toBe('translate(100, 100)');
    });
});

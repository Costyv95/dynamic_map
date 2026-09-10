import { describe, it, expect } from 'vitest';
import {
    computeViewport, roomBounds, shouldRotate, fitToAspect, labelTransform,
    mapPointToView, viewPointToMap, roomViewBox
} from '../core/Viewport.js';

const rooms = [{ id: 'a', polygon: [[10, 10], [90, 10], [90, 50], [10, 50]] }]; // landscape 800x400 on 1000x1000
const base = { rooms, imgW: 1000, imgH: 1000 };

describe('roomBounds / shouldRotate / fitToAspect', () => {
    it('measures room extents in map pixels', () => {
        expect(roomBounds(rooms, 1000, 1000)).toEqual({ minX: 100, maxX: 900, minY: 100, maxY: 500, w: 800, h: 400 });
        expect(roomBounds([], 1000, 1000)).toBeNull();
    });

    it('rotates only when the map and screen disagree in auto mode', () => {
        expect(shouldRotate('auto', true, true)).toBe(false);
        expect(shouldRotate('auto', true, false)).toBe(true);
        expect(shouldRotate('horizontal', false, true)).toBe(true);
        expect(shouldRotate('vertical', true, false)).toBe(true);
        expect(shouldRotate('vertical', false, true)).toBe(false);
    });

    it('expands to the screen aspect without shrinking either side', () => {
        expect(fitToAspect(100, 100, 2)).toEqual({ w: 200, h: 100 });
        expect(fitToAspect(100, 100, 0.5)).toEqual({ w: 100, h: 200 });
    });
});

describe('computeViewport', () => {
    it('frames the rooms with 15% padding on a matching landscape screen', () => {
        const vp = computeViewport({ ...base, screenW: 1300, screenH: 650 });
        expect(vp.isRotated).toBe(false);
        expect(vp.activeMode).toBe('horizontal');
        expect(vp.transform).toBe('');
        expect(vp.vb.w).toBeCloseTo(1040, 5);
        expect(vp.vb.h).toBeCloseTo(520, 5);
        expect(vp.vb.x).toBeCloseTo(500 - 520, 5);
    });

    it('rotates a landscape map on a portrait screen and swaps the target box', () => {
        const vp = computeViewport({ ...base, screenW: 500, screenH: 1000 });
        expect(vp.isRotated).toBe(true);
        expect(vp.activeMode).toBe('vertical');
        expect(vp.transform).toBe('rotate(90, 500, 300)');
        expect(vp.vb.w).toBeCloseTo(520, 5);
        expect(vp.vb.h).toBeCloseTo(1040, 5);
    });

    it('applies flips of the active mode, swapping axes when rotated', () => {
        const flips = { horizontal: { h: true, v: false }, vertical: { h: true, v: false } };
        const flat = computeViewport({ ...base, screenW: 1300, screenH: 650, flips });
        expect(flat.scaleX).toBe(-1);
        expect(flat.transform).toBe('translate(500, 300) scale(-1, 1) translate(-500, -300)');
        const turned = computeViewport({ ...base, screenW: 500, screenH: 1000, flips });
        expect(turned.scaleY).toBe(-1);
        expect(turned.scaleX).toBe(1);
    });

    it('falls back to the full image without rooms', () => {
        const vp = computeViewport({ rooms: [], imgW: 800, imgH: 600, screenW: 100, screenH: 100 });
        expect(vp.vb).toEqual({ x: 0, y: 0, w: 800, h: 600 });
        expect(vp.transform).toBe('');
    });
});

describe('point mapping', () => {
    const vp = computeViewport({ ...base, screenW: 500, screenH: 1000, flips: { horizontal: { h: false, v: false }, vertical: { h: true, v: false } } });

    it('round-trips through the rotation and flip', () => {
        const p = mapPointToView(vp, 123, 456);
        const back = viewPointToMap(vp, p.x, p.y);
        expect(back.x).toBeCloseTo(123, 6);
        expect(back.y).toBeCloseTo(456, 6);
    });

    it('produces an upright label transform only when the root is transformed', () => {
        expect(labelTransform({ transform: '', isRotated: false, scaleX: 1, scaleY: 1 }, 1, 2)).toBeNull();
        expect(labelTransform(vp, 10, 20)).toBe('translate(10, 20) scale(1, -1) rotate(-90) translate(-10, -20)');
    });

    it('frames a room at the screen aspect with a minimum width', () => {
        const flat = computeViewport({ ...base, screenW: 1000, screenH: 1000 });
        const mapPoint = (x, y) => mapPointToView(flat, x, y);
        const box = roomViewBox({ mapPoint, room: rooms[0], imgW: 1000, imgH: 1000, screenRatio: 1, minW: 50 });
        expect(box.w).toBeCloseTo(992, 5);
        expect(box.h).toBeCloseTo(992, 5);
        const tiny = roomViewBox({ mapPoint, room: { polygon: [[50, 50], [51, 50], [51, 51], [50, 51]] }, imgW: 1000, imgH: 1000, screenRatio: 2, minW: 50 });
        expect(tiny.w).toBe(50);
        expect(tiny.h).toBe(25);
    });
});

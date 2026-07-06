import { describe, it, expect } from 'vitest';
import {
    isOrientationObject,
    resolveOriented,
    resolveOrientedLoose,
    resolveOrientedStrict,
    writeOriented,
    resolvePreviewTarget,
    isProportional,
    getPosition,
    setPosition,
    getScale,
    setScale,
    getRotation,
    setRotation
} from '../shared/OrientationProps.js';

describe('OrientationProps', () => {
    describe('isOrientationObject', () => {
        it('detects orientation objects and rejects plain values, arrays, and null', () => {
            expect(isOrientationObject({ horizontal: 1, vertical: 2 })).toBe(true);
            expect(isOrientationObject({ horizontal: 1 })).toBe(true);
            expect(isOrientationObject(1.5)).toBe(false);
            expect(isOrientationObject([10, 20])).toBe(false);
            expect(isOrientationObject(null)).toBe(false);
            expect(isOrientationObject(undefined)).toBe(false);
        });
    });

    describe('resolveOriented', () => {
        it('returns plain values as-is (including falsy 0)', () => {
            expect(resolveOriented(2.5, 'vertical', 1.0)).toBe(2.5);
            expect(resolveOriented(0, 'horizontal', 1.0)).toBe(0);
        });

        it('returns the fallback when the value is undefined', () => {
            expect(resolveOriented(undefined, 'horizontal', 1.0)).toBe(1.0);
        });

        it('resolves the active mode from an orientation object', () => {
            const val = { horizontal: 1.5, vertical: 3.0 };
            expect(resolveOriented(val, 'horizontal', 1.0)).toBe(1.5);
            expect(resolveOriented(val, 'vertical', 1.0)).toBe(3.0);
        });

        it('falls back to horizontal when the active mode is missing', () => {
            expect(resolveOriented({ horizontal: 1.5 }, 'vertical', 1.0)).toBe(1.5);
        });

        it('honors a falsy (0) value for the active mode via !== undefined', () => {
            expect(resolveOriented({ horizontal: 1.5, vertical: 0 }, 'vertical', 1.0)).toBe(0);
        });

        it('uses || on the horizontal leg: falsy horizontal falls through to the fallback', () => {
            expect(resolveOriented({ horizontal: 0 }, 'vertical', 1.0)).toBe(1.0);
        });
    });

    describe('resolveOrientedLoose', () => {
        it('returns plain values or the fallback when falsy', () => {
            expect(resolveOrientedLoose([10, 20], 'vertical', [50, 50])).toEqual([10, 20]);
            expect(resolveOrientedLoose(undefined, 'vertical', [50, 50])).toEqual([50, 50]);
        });

        it('resolves the active mode, then horizontal, then the fallback', () => {
            const val = { horizontal: [10, 20], vertical: [45, 90] };
            expect(resolveOrientedLoose(val, 'vertical', [50, 50])).toEqual([45, 90]);
            expect(resolveOrientedLoose({ horizontal: [10, 20] }, 'vertical', [50, 50])).toEqual([10, 20]);
            expect(resolveOrientedLoose({}, 'vertical', [50, 50])).toEqual([50, 50]);
        });
    });

    describe('resolveOrientedStrict', () => {
        it('returns plain values (including undefined) as-is', () => {
            expect(resolveOrientedStrict(2, 'vertical')).toBe(2);
            expect(resolveOrientedStrict(undefined, 'vertical')).toBeUndefined();
        });

        it('resolves the active mode, falling back to horizontal even when horizontal is falsy', () => {
            expect(resolveOrientedStrict({ horizontal: 1, vertical: 2 }, 'vertical')).toBe(2);
            expect(resolveOrientedStrict({ horizontal: 0 }, 'vertical')).toBe(0);
        });
    });

    describe('writeOriented', () => {
        it('converts a plain value into an orientation object seeded with the old value', () => {
            const obj = { scale: 2.0 };
            writeOriented(obj, 'scale', 'vertical', 3.5, 1.0);
            expect(obj.scale).toEqual({ horizontal: 2.0, vertical: 3.5 });
        });

        it('seeds both modes with the default when the prop was undefined', () => {
            const obj = {};
            writeOriented(obj, 'rotation', 'horizontal', 45, 0);
            expect(obj.rotation).toEqual({ horizontal: 45, vertical: 0 });
        });

        it('writes only the active mode on an existing orientation object', () => {
            const obj = { scale: { horizontal: 1.5, vertical: 2.5 } };
            writeOriented(obj, 'scale', 'vertical', 4.0, 1.0);
            expect(obj.scale).toEqual({ horizontal: 1.5, vertical: 4.0 });
        });
    });

    describe('resolvePreviewTarget', () => {
        const sc = {
            config: {
                states: [{ id: 'st1', scale: 2.0 }]
            }
        };

        it('returns the shortcut itself when no preview state is active', () => {
            expect(resolvePreviewTarget(sc, -1)).toBe(sc);
        });

        it('returns the previewed state when active', () => {
            expect(resolvePreviewTarget(sc, 0)).toBe(sc.config.states[0]);
        });

        it('returns the shortcut when the preview index has no matching state', () => {
            expect(resolvePreviewTarget(sc, 5)).toBe(sc);
        });

        it('only targets the state when it defines the required prop', () => {
            expect(resolvePreviewTarget(sc, 0, 'scale')).toBe(sc.config.states[0]);
            expect(resolvePreviewTarget(sc, 0, 'position')).toBe(sc);
        });
    });

    describe('isProportional', () => {
        it('defaults to true for circles and false for rects', () => {
            expect(isProportional({ config: { shape: 'circle' } })).toBe(true);
            expect(isProportional({ config: { shape: 'rect' } })).toBe(false);
            expect(isProportional({})).toBe(true); // shape defaults to circle
        });

        it('lets config.proportional override the shape default', () => {
            expect(isProportional({ config: { shape: 'circle', proportional: false } })).toBe(false);
            expect(isProportional({ config: { shape: 'rect', proportional: true } })).toBe(true);
        });
    });

    describe('getPosition / setPosition', () => {
        it('reads plain positions and orientation objects with mode fallback', () => {
            expect(getPosition({ position: [15, 30] }, 'vertical')).toEqual([15, 30]);
            expect(getPosition({ position: { horizontal: [10, 20], vertical: [45, 90] } }, 'vertical')).toEqual([45, 90]);
            expect(getPosition({ position: { horizontal: [10, 20] } }, 'vertical')).toEqual([10, 20]);
            expect(getPosition({}, 'horizontal')).toEqual([50, 50]);
        });

        it('setter converts a plain position into an orientation object, copying the old array', () => {
            const target = { position: [15, 30] };
            setPosition(target, 'vertical', 60, 70);
            expect(target.position).toEqual({ horizontal: [15, 30], vertical: [60, 70] });
            // horizontal must be a copy, not the same array reference
            expect(target.position.horizontal).not.toBe(target.position.vertical);
        });

        it('setter seeds [50, 50] when there was no position, and writes only the active mode afterwards', () => {
            const target = {};
            setPosition(target, 'horizontal', 25, 35);
            expect(target.position).toEqual({ horizontal: [25, 35], vertical: [50, 50] });

            setPosition(target, 'vertical', 1, 2);
            expect(target.position).toEqual({ horizontal: [25, 35], vertical: [1, 2] });
        });
    });

    describe('getScale / setScale', () => {
        it('defaults to 1.0 everywhere when nothing is set', () => {
            const sc = { config: { shape: 'rect' } };
            expect(getScale(sc, sc, 'horizontal')).toEqual({ scale: 1.0, scaleX: 1.0, scaleY: 1.0 });
        });

        it('reads plain scale values, with scale acting as the scaleX/scaleY fallback', () => {
            const sc = { scale: 2.0, config: { shape: 'rect' } };
            expect(getScale(sc, sc, 'horizontal')).toEqual({ scale: 2.0, scaleX: 2.0, scaleY: 2.0 });
        });

        it('reads orientation-object scales for the active mode with horizontal fallback', () => {
            const sc = {
                scaleX: { horizontal: 2.0, vertical: 3.0 },
                scaleY: { horizontal: 1.5 },
                config: { shape: 'rect' }
            };
            expect(getScale(sc, sc, 'vertical')).toEqual({ scale: 1.0, scaleX: 3.0, scaleY: 1.5 });
        });

        it('returns a uniform scale (scaleX) for proportional shortcuts', () => {
            const sc = { scaleX: 2.0, scaleY: 3.0, config: { shape: 'circle' } };
            expect(getScale(sc, sc, 'horizontal')).toEqual({ scale: 2.0, scaleX: 2.0, scaleY: 2.0 });
        });

        it('falls back from a state override target to the base shortcut', () => {
            const state = {};
            const sc = { scaleX: 2.5, config: { shape: 'rect', states: [state] } };
            expect(getScale(sc, state, 'horizontal').scaleX).toBe(2.5);

            // state override wins when defined
            const state2 = { scaleX: 4.0 };
            const sc2 = { scaleX: 2.5, config: { shape: 'rect', states: [state2] } };
            expect(getScale(sc2, state2, 'horizontal').scaleX).toBe(4.0);
        });

        it('setter creates an orientation object from a plain value (non-proportional)', () => {
            const sc = { scaleX: 2.0, config: { shape: 'rect' } };
            setScale(sc, sc, 'scaleX', 'vertical', 3.0);
            expect(sc.scaleX).toEqual({ horizontal: 2.0, vertical: 3.0 });
            expect(sc.scaleY).toBeUndefined();
            expect(sc.scale).toBeUndefined();
        });

        it('setter writes scale, scaleX and scaleY uniformly for proportional shortcuts', () => {
            const sc = { config: { shape: 'circle' } };
            setScale(sc, sc, 'scaleX', 'horizontal', 2.5);
            expect(sc.scale).toEqual({ horizontal: 2.5, vertical: 1.0 });
            expect(sc.scaleX).toEqual({ horizontal: 2.5, vertical: 1.0 });
            expect(sc.scaleY).toEqual({ horizontal: 2.5, vertical: 1.0 });
        });

        it('setter targets the state override object when given', () => {
            const state = {};
            const sc = { config: { shape: 'rect', states: [state] } };
            setScale(sc, state, 'scaleY', 'horizontal', 2.0);
            expect(state.scaleY).toEqual({ horizontal: 2.0, vertical: 1.0 });
            expect(sc.scaleY).toBeUndefined();
        });
    });

    describe('getRotation / setRotation', () => {
        it('defaults to 0 and reads plain values', () => {
            expect(getRotation({}, {}, 'horizontal')).toBe(0);
            const sc = { rotation: 45 };
            expect(getRotation(sc, sc, 'vertical')).toBe(45);
        });

        it('reads orientation objects with missing-mode fallback to horizontal', () => {
            const sc = { rotation: { horizontal: 90, vertical: 180 } };
            expect(getRotation(sc, sc, 'vertical')).toBe(180);
            const sc2 = { rotation: { horizontal: 90 } };
            expect(getRotation(sc2, sc2, 'vertical')).toBe(90);
        });

        it('falls back from a state override target to the base shortcut', () => {
            const state = {};
            const sc = { rotation: 30, config: { states: [state] } };
            expect(getRotation(sc, state, 'horizontal')).toBe(30);
        });

        it('setter converts a plain rotation into an orientation object', () => {
            const target = { rotation: 15 };
            setRotation(target, 'vertical', 75);
            expect(target.rotation).toEqual({ horizontal: 15, vertical: 75 });
        });

        it('setter seeds 0 when no rotation existed', () => {
            const target = {};
            setRotation(target, 'horizontal', 90);
            expect(target.rotation).toEqual({ horizontal: 90, vertical: 0 });
        });
    });
});

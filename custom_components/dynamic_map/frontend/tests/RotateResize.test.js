import { describe, it, expect, beforeEach } from 'vitest';
import { EditorInteractionManager } from '../editor/EditorInteractionManager.js';

// Drives onPointerMove directly with a stubbed getMousePos, the same way the
// browser would after a mousedown claimed RESIZE_SC / ROTATE_SC.

function makeShortcut(rotation) {
    return {
        id: 'sc_t',
        type: 'light',
        position: [50, 50],
        rotation,
        config: { shape: 'rect', proportional: false }
    };
}

function makeManager(sc) {
    const state = {
        shortcuts: [sc],
        selectedShortcutIdx: 0,
        previewStateIdx: -1,
        bgImage: { width: 1000, height: 1000 },
        rooms: [],
        saveState() {},
        updateUICallback() {},
        requestDrawCallback() {}
    };
    const canvas = document.createElement('canvas');
    const engine = { isRotated: false, activeMode: 'horizontal', viewTransform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } };
    const im = new EditorInteractionManager(canvas, engine, state);
    return { im, state };
}

describe('rotation-aware resize', () => {
    let im, sc;
    beforeEach(() => {
        sc = makeShortcut(90);
        ({ im } = makeManager(sc));
        im.interactionState = 'RESIZE_SC';
    });

    it('maps the drag onto the shape\'s local axis when rotated 90deg', () => {
        // At rotation 90 the E handle points UP on screen: dragging 48px above
        // the center must set scaleX = 48/12 = 4 (the old code read dx=0).
        im.resizeHandle = 'E';
        im.getMousePos = () => ({ x: 500, y: 452 });
        im.onPointerMove({ preventDefault() {} });
        expect(im.getShortcutScale(sc).scaleX).toBeCloseTo(4);
    });

    it('N/S handles follow the rotated axis too', () => {
        // At rotation 90 the N handle points RIGHT on screen: dragging 36px
        // right of center must set scaleY = 36/12 = 3.
        im.resizeHandle = 'N';
        im.getMousePos = () => ({ x: 536, y: 500 });
        im.onPointerMove({ preventDefault() {} });
        expect(im.getShortcutScale(sc).scaleY).toBeCloseTo(3);
    });

    it('unrotated shapes keep the classic screen-axis behavior', () => {
        const plain = makeShortcut(0);
        const { im: im2 } = makeManager(plain);
        im2.interactionState = 'RESIZE_SC';
        im2.resizeHandle = 'E';
        im2.getMousePos = () => ({ x: 524, y: 500 });
        im2.onPointerMove({ preventDefault() {} });
        expect(im2.getShortcutScale(plain).scaleX).toBeCloseTo(2);
    });
});

describe('orientation flip rebuilds shortcut layouts', () => {
    function makeCropCard() {
        const card = document.createElement('custom-svg-map');
        card.config = {};
        card.imgW = 1000;
        card.imgH = 1000;
        card.rotationMode = 'auto';
        card.flips = { horizontal: { h: false, v: false }, vertical: { h: false, v: false } };
        card.mapRoot = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        // Wide map + jsdom's 0-size (ratio 1 => "portrait") screen => rotated
        card.rooms = [{ id: 'r', polygon: [[5, 40], [95, 40], [95, 60], [5, 60]] }];
        card.updateViewBox = () => {};
        card.syncFocusPill = () => {};
        card.applyShortcutTransforms = () => {};
        card._hass = { states: {} };
        return card;
    }

    it('re-runs updateState on every shortcut when the active mode changes', async () => {
        await import('../custom-svg-map.js');
        const card = makeCropCard();
        let calls = 0;
        card.shortcutElements = { sc1: { updateState: () => { calls++; } } };
        card._lastAppliedMode = undefined;
        card.calculateAutoCrop();
        expect(card.isRotated).toBe(true);
        expect(calls).toBe(1);
        // Same orientation again: no redundant rebuild
        card.calculateAutoCrop();
        expect(calls).toBe(1);
    });
});

describe('rotation handle drag', () => {
    it('sets the rotation from the drag angle (up = 0deg, right = 90deg)', () => {
        const sc = makeShortcut(0);
        const { im } = makeManager(sc);
        im.interactionState = 'ROTATE_SC';
        im.getMousePos = () => ({ x: 560, y: 500 }); // due right of center
        im.onPointerMove({ preventDefault() {} });
        expect(im.getShortcutRotation(sc)).toBe(90);
    });

    it('soft-snaps to 15deg multiples and normalizes to 0..359', () => {
        const sc = makeShortcut(0);
        const { im } = makeManager(sc);
        im.interactionState = 'ROTATE_SC';
        // ~272deg raw (atan2 => 182deg + 90) -> within 4deg of 270 -> snapped
        im.getMousePos = () => ({ x: 440, y: 502 });
        im.onPointerMove({ preventDefault() {} });
        expect(im.getShortcutRotation(sc)).toBe(270);
    });

    it('saveState fires on mouseup after a rotate drag', () => {
        const sc = makeShortcut(0);
        const { im, state } = makeManager(sc);
        let saves = 0;
        state.saveState = () => { saves++; };
        im.interactionState = 'ROTATE_SC';
        im.getMousePos = () => ({ x: 560, y: 500 });
        im.onPointerMove({ preventDefault() {} });
        im.onPointerUp({ preventDefault() {} });
        expect(saves).toBe(1);
        expect(im.interactionState).toBe('NONE');
    });
});

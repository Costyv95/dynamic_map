import { describe, it, expect } from 'vitest';

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

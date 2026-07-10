import { describe, it, expect, vi } from 'vitest';
import { MapShortcut } from '../shortcuts/MapShortcut.js';
import { EditorStateManager } from '../editor/EditorStateManager.js';

const svgNS = 'http://www.w3.org/2000/svg';

describe('decor shortcuts (card)', () => {
    const decorData = {
        id: 'sc_couch', type: 'generic', position: [50, 50], scaleX: 4, scaleY: 2,
        config: { shape: 'rect', color: '#94a3b8', transparent: true, decor: true, autoRotate: true }
    };

    it('a decor item never intercepts pointer events and binds no interactions', () => {
        const sc = new MapShortcut(decorData, svgNS, 1000, 1000, { _hass: null, imgW: 1000, imgH: 1000 });
        sc.render();
        expect(sc.group.style.pointerEvents).toBe('none');
        expect(sc.hitbox).toBeUndefined();
        expect(sc.group.style.cursor).not.toBe('pointer');
    });

    it('a normal shortcut keeps its hitbox and pointer cursor', () => {
        const sc = new MapShortcut({
            id: 'sc_n', type: 'generic', position: [50, 50],
            config: { shape: 'circle', color: '#0ea5e9' }
        }, svgNS, 1000, 1000, { _hass: null, imgW: 1000, imgH: 1000 });
        sc.render();
        expect(sc.hitbox).toBeTruthy();
        expect(sc.group.style.cursor).toBe('pointer');
    });

    it('glow anchors before the decor layer, never inside it', () => {
        // Regression: host.querySelector('.shortcut-group') used to descend
        // into the decor sub-layer and hand insertBefore a non-child anchor.
        const mapRoot = document.createElementNS(svgNS, 'g');
        const decorLayer = document.createElementNS(svgNS, 'g');
        decorLayer.classList.add('dm-decor-layer');
        mapRoot.appendChild(decorLayer);
        const decorGroup = document.createElementNS(svgNS, 'g');
        decorGroup.classList.add('shortcut-group');
        decorLayer.appendChild(decorGroup);

        const hass = { states: { 'light.l': { state: 'on', attributes: { rgb_color: [255, 0, 0] } } } };
        const sc = new MapShortcut({
            id: 'sc_l', entity_id: 'light.l', type: 'light', position: [50, 50],
            config: { shape: 'circle', color: '#475569' }
        }, svgNS, 1000, 1000, { _hass: hass, imgW: 1000, imgH: 1000, mapRoot, rooms: [] });
        mapRoot.appendChild(sc.render());
        expect(() => sc.updateState(hass)).not.toThrow();
        expect(sc.glowGroup.parentNode).toBe(mapRoot);
        // glow renders beneath the decor layer (and thus beneath all badges)
        const kids = [...mapRoot.children];
        expect(kids.indexOf(sc.glowGroup)).toBeLessThan(kids.indexOf(decorLayer));
    });
});

describe('decor layer (editor state)', () => {
    it('switching layers deselects and notifies UI + canvas', () => {
        const ui = vi.fn(), draw = vi.fn();
        const state = new EditorStateManager(ui, draw);
        expect(state.activeLayer).toBe('objects');
        state.selectedShortcutIdx = 3;
        state.setActiveLayer('decor');
        expect(state.activeLayer).toBe('decor');
        expect(state.selectedShortcutIdx).toBe(-1);
        expect(ui).toHaveBeenCalled();
        expect(draw).toHaveBeenCalled();
    });

    it('re-selecting the active layer is a no-op', () => {
        const ui = vi.fn(), draw = vi.fn();
        const state = new EditorStateManager(ui, draw);
        state.selectedShortcutIdx = 2;
        state.setActiveLayer('objects');
        expect(state.selectedShortcutIdx).toBe(2);
        expect(ui).not.toHaveBeenCalled();
    });
});

import { describe, it, expect, vi } from 'vitest';
import { framesOf, alignTargets, distributeTargets, applyTargets, matchSizeTargets, applySizes } from '../editor/Align.js';
import { EditorStateManager } from '../editor/EditorStateManager.js';
import { ShortcutTool } from '../editor/tools/ShortcutTool.js';
import { shortcutFrame } from '../shared/ShortcutGeometry.js';

const opts = { mode: 'horizontal', imgW: 1000, imgH: 1000 };
const mk = (id, x, y, sx = 1) => ({ id, position: [x, y], scaleX: sx, scaleY: sx, config: { shape: 'rect', proportional: false } });

describe('Align', () => {
    it('aligns to the reference badge edges and centres', () => {
        const a = mk('a', 50, 50, 2), b = mk('b', 20, 20), c = mk('c', 80, 90);
        const frames = framesOf([a, b, c], opts);
        applyTargets(alignTargets(frames, 'left', frames[0]), { ...opts, mode: 'both' });
        expect(shortcutFrame(b, opts).x).toBeCloseTo(500 - 24 + 12, 5);   // ref left edge + half own width
        applyTargets(alignTargets(framesOf([a, b, c], opts), 'middle', framesOf([a], opts)[0]), { ...opts, mode: 'both' });
        expect(shortcutFrame(c, opts).y).toBeCloseTo(500, 5);
    });

    it('distributes three or more evenly and matches sizes', () => {
        const a = mk('a', 10, 50), b = mk('b', 90, 50), c = mk('c', 30, 50);
        applyTargets(distributeTargets(framesOf([a, b, c], opts), 'x'), { ...opts, mode: 'both' });
        expect(shortcutFrame(c, opts).x).toBeCloseTo(500, 5);
        expect(distributeTargets(framesOf([a, b], opts), 'x')).toEqual([]);
        const ref = mk('r', 50, 50, 3);
        applySizes(matchSizeTargets(framesOf([ref, a], opts)), { ...opts, mode: 'both' });
        expect(shortcutFrame(a, opts).w).toBeCloseTo(72, 5);
    });
});

describe('multi-selection state', () => {
    it('toggles extras, promotes when the primary is removed, deletes all', () => {
        const st = new EditorStateManager(vi.fn(), vi.fn());
        st.shortcuts = [mk('a', 1, 1), mk('b', 2, 2), mk('c', 3, 3)];
        st.selectedShortcutIdx = 0;
        st.toggleExtraSelection(2);
        expect(st.selectionIndices()).toEqual([0, 2]);
        st.toggleExtraSelection(0);   // remove the primary: c becomes primary
        expect(st.selectedShortcutIdx).toBe(2);
        expect(st.selectionIndices()).toEqual([2]);
        st.toggleExtraSelection(1);
        st.saveState();
        expect(st.deleteSelection()).toBe(true);
        expect(st.shortcuts.map(s => s.id)).toEqual(['a']);
        expect(st.selectionIndices()).toEqual([]);
    });
});

describe('ShortcutTool with several selected', () => {
    const canvas = () => ({ imgW: 1000, imgH: 1000, activeMode: 'horizontal', isRotated: false, linkOrientations: true, pxPerUnit: () => 1, _hass: null });
    const ev = (extra = {}) => ({ button: 0, preventDefault() {}, ...extra });

    it('shift-click adds a badge; dragging the reference moves companions by the same delta', () => {
        const state = new EditorStateManager(vi.fn(), vi.fn());
        state.shortcuts = [mk('a', 50, 50), mk('b', 20, 20)];
        state.activeLayer = 'objects';
        state.selectedShortcutIdx = 0;
        const tool = new ShortcutTool(canvas(), state);
        expect(tool.onDown(ev({ shiftKey: true }), { kind: 'shortcut', id: 'b' }, { x: 200, y: 200 })).toBe(true);
        expect(state.selectionIndices()).toEqual([0, 1]);
        tool.onDown(ev(), { kind: 'shortcut', id: 'a' }, { x: 500, y: 500 });
        tool.onMove(ev({ altKey: true }), { x: 600, y: 650 });
        tool.onUp();
        expect(shortcutFrame(state.shortcuts[0], opts)).toMatchObject({ x: 600, y: 650 });
        expect(shortcutFrame(state.shortcuts[1], opts)).toMatchObject({ x: 300, y: 350 });
        expect(tool.nudge(10, 0)).toBe(true);
        expect(shortcutFrame(state.shortcuts[1], opts).x).toBeCloseTo(310, 5);
    });
});

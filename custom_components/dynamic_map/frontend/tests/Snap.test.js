import { describe, it, expect, vi } from 'vitest';
import { snapTargets, snapPoint } from '../editor/Snap.js';
import { ShortcutTool } from '../editor/tools/ShortcutTool.js';
import { ToolRouter } from '../editor/ToolRouter.js';

const rooms = [{ id: 'r', polygon: [[10, 10], [30, 10], [30, 30], [10, 30]] }];   // 100..300 on a 1000px map
const shortcuts = [
    { id: 'a', position: [50, 50], config: {} },
    { id: 'b', position: [70, 20], config: {} }
];

describe('snap targets and points', () => {
    it('collects other badges and room centres/edges, excluding the dragged badge', () => {
        const t = snapTargets({ shortcuts, rooms, imgW: 1000, imgH: 1000, mode: 'horizontal', excludeId: 'a' });
        expect(t.xs.map(x => x.v)).toEqual([700, 200, 100, 300]);
        expect(t.ys.map(y => y.v)).toEqual([200, 200, 100, 300]);
    });

    it('snaps each axis independently within the tolerance and reports guides', () => {
        const t = snapTargets({ shortcuts, rooms, imgW: 1000, imgH: 1000, mode: 'horizontal', excludeId: 'a' });
        const r = snapPoint(704, 455, t, 6);
        expect(r.x).toBe(700);
        expect(r.y).toBe(455);
        expect(r.guides).toEqual([{ axis: 'x', value: 700, kind: 'badge' }]);
        expect(snapPoint(650, 650, t, 6).guides).toEqual([]);
    });
});

function makeState() {
    return {
        shortcuts: JSON.parse(JSON.stringify(shortcuts)), rooms, walls: [], selectedShortcutIdx: 0, selectedRooms: [], selectedWallIdx: -1,
        previewStateIdx: -1, isEditMode: false, activeLayer: 'objects', drawingPolygon: null, drawingWall: null,
        saveState: vi.fn(), updateUICallback: vi.fn(), requestDrawCallback: vi.fn(), deleteSelection: vi.fn()
    };
}
const canvas = () => ({ imgW: 1000, imgH: 1000, activeMode: 'horizontal', isRotated: false, linkOrientations: true, pxPerUnit: () => 1, toPercent: (x, y) => [x / 10, y / 10], _hass: null });
const ev = (extra = {}) => ({ button: 0, preventDefault() {}, ...extra });

describe('ShortcutTool snapping and nudging', () => {
    it('snaps a drag onto another badge and exposes guides; Alt disables it', () => {
        const state = makeState();
        const tool = new ShortcutTool(canvas(), state);
        tool.onDown(ev(), { kind: 'shortcut', id: 'a' }, { x: 500, y: 500 });
        tool.onMove(ev(), { x: 704, y: 455 });
        expect(state.shortcuts[0].position.horizontal).toEqual([70, 45.5]);
        expect(state.snapGuides).toEqual([{ axis: 'x', value: 700, kind: 'badge' }]);
        tool.onMove(ev({ altKey: true }), { x: 704, y: 455 });
        expect(state.shortcuts[0].position.horizontal[0]).toBeCloseTo(70.4, 6);
        expect(state.snapGuides).toBeNull();
        tool.onUp();
        expect(state.snapGuides).toBeNull();
    });

    it('nudge moves by map units and saves', () => {
        const state = makeState();
        const tool = new ShortcutTool(canvas(), state);
        expect(tool.nudge(10, -1)).toBe(true);
        expect(state.shortcuts[0].position.horizontal).toEqual([51, 49.9]);
        expect(state.saveState).toHaveBeenCalledTimes(1);
    });
});

describe('ToolRouter keyboard', () => {
    function makeRouter(state) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        document.body.appendChild(svg);
        const c = { ...canvas(), svg, camera: { pointerDown() {}, pointerMove() { return false; }, pointerUp() { return false; }, startPan() {}, pointers: new Map(), pinch: null }, clientToMap: (x, y) => ({ x, y }) };
        return new ToolRouter(c, state);
    }

    it('arrow keys nudge the selection (Shift = 10) unless typing', () => {
        const state = makeState();
        const router = makeRouter(state);
        router.onKeyDown({ key: 'ArrowRight', target: document.body, preventDefault() {} });
        expect(state.shortcuts[0].position.horizontal[0]).toBe(50.1);
        router.onKeyDown({ key: 'ArrowDown', shiftKey: true, target: document.body, preventDefault() {} });
        expect(state.shortcuts[0].position.horizontal[1]).toBe(51);
        const input = document.createElement('input');
        router.onKeyDown({ key: 'ArrowLeft', target: input, preventDefault() {} });
        expect(state.shortcuts[0].position.horizontal[0]).toBe(50.1);
    });

    it('Escape clears the selection', () => {
        const state = makeState();
        const router = makeRouter(state);
        router.onKeyDown({ key: 'Escape', target: document.body, preventDefault() {} });
        expect(state.selectedShortcutIdx).toBe(-1);
        expect(state.updateUICallback).toHaveBeenCalled();
    });
});

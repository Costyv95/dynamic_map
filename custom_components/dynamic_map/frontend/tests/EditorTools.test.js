import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShortcutTool } from '../editor/tools/ShortcutTool.js';
import { RoomTool } from '../editor/tools/RoomTool.js';
import { WallTool } from '../editor/tools/WallTool.js';
import { shortcutFrame } from '../shared/ShortcutGeometry.js';
import { polygonArea, projectOnSegment, describeTarget } from '../editor/HitTest.js';

// Tools are driven the way the router drives them: onDown(e, hit, pt) then
// onMove(e, pt) then onUp(), with pt in map pixels.

function makeState(extra = {}) {
    return {
        shortcuts: [], rooms: [], walls: [], selectedShortcutIdx: -1, selectedRooms: [], selectedWallIdx: -1,
        previewStateIdx: -1, isEditMode: true, activeLayer: 'objects', drawingPolygon: null, drawingWall: null,
        _saves: 0, saveState() { this._saves++; }, updateUICallback: vi.fn(), requestDrawCallback: vi.fn(),
        ...extra
    };
}
const canvas = (extra = {}) => ({ imgW: 1000, imgH: 1000, activeMode: 'horizontal', isRotated: false, linkOrientations: true,
    toPercent: (x, y) => [x / 10, y / 10], _hass: null, ...extra });
const ev = (extra = {}) => ({ button: 0, preventDefault() {}, ...extra });

describe('ShortcutTool', () => {
    let state, tool, sc;
    beforeEach(() => {
        sc = { id: 'a', type: 'light', position: [50, 50], rotation: 90, config: { shape: 'rect', proportional: false } };
        state = makeState({ shortcuts: [sc], selectedShortcutIdx: 0 });
        tool = new ShortcutTool(canvas(), state);
    });

    it('drags by the pointer delta, keeping the grab offset', () => {
        expect(tool.onDown(ev(), { kind: 'shortcut', id: 'a' }, { x: 505, y: 500 })).toBe(true);
        tool.onMove(ev(), { x: 605, y: 600 });
        tool.onUp();
        expect(sc.position).toEqual({ horizontal: [60, 60], vertical: [60, 60] });
        expect(state._saves).toBe(1);
    });

    it('writes only the active layout when unlinked', () => {
        tool = new ShortcutTool(canvas({ linkOrientations: false, activeMode: 'vertical' }), state);
        tool.onDown(ev(), { kind: 'shortcut', id: 'a' }, { x: 500, y: 500 });
        tool.onMove(ev(), { x: 600, y: 500 });
        expect(sc.position.vertical).toEqual([60, 50]);
        expect(sc.position.horizontal).toEqual([50, 50]);
    });

    it('resizes along the rotated local axis: E handle at rotation 90 points down on screen', () => {
        tool.onDown(ev(), { kind: 'handle', handle: 'E' }, { x: 500, y: 500 });
        tool.onMove(ev(), { x: 500, y: 548 });   // 48px below centre = local +x
        expect(shortcutFrame(sc, { imgW: 1000, imgH: 1000 }).w).toBeCloseTo(96);
        tool.onDown(ev(), { kind: 'handle', handle: 'N' }, { x: 500, y: 500 });
        tool.onMove(ev(), { x: 536, y: 500 });   // 36px right = local -y
        expect(shortcutFrame(sc, { imgW: 1000, imgH: 1000 }).h).toBeCloseTo(72);
    });

    it('keeps proportional badges square on any handle', () => {
        sc.rotation = 0;
        sc.config = { shape: 'circle' };
        tool.onDown(ev(), { kind: 'handle', handle: 'E' }, { x: 500, y: 500 });
        tool.onMove(ev(), { x: 524, y: 500 });
        const f = shortcutFrame(sc, { imgW: 1000, imgH: 1000 });
        expect(f.w).toBeCloseTo(48);
        expect(f.h).toBeCloseTo(48);
    });

    it('rotation handle: pointer due right of the centre = 90deg, snapped', () => {
        sc.rotation = 0;
        tool.onDown(ev(), { kind: 'handle', handle: 'ROT' }, { x: 500, y: 480 });
        tool.onMove(ev(), { x: 560, y: 502 });
        expect(sc.rotation).toEqual({ horizontal: 90, vertical: 90 });
    });

    it('ignores badges on the inactive layer', () => {
        state.activeLayer = 'decor';
        expect(tool.onDown(ev(), { kind: 'shortcut', id: 'a' }, { x: 500, y: 500 })).toBe(false);
    });
});

describe('RoomTool', () => {
    let state, tool;
    beforeEach(() => {
        state = makeState({ rooms: [{ id: 'r', name: 'R', polygon: [[10, 10], [30, 10], [30, 30], [10, 30]] }], selectedRooms: [0] });
        tool = new RoomTool(canvas(), state);
    });

    it('drags a corner and saves once on release', () => {
        tool.onDown(ev(), { kind: 'handle', handle: 'vertex', roomIdx: 0, vertexIdx: 2 }, { x: 300, y: 300 });
        tool.onMove(ev(), { x: 400, y: 350 });
        tool.onUp();
        expect(state.rooms[0].polygon[2]).toEqual([40, 35]);
        expect(state._saves).toBe(1);
    });

    it('inserts a corner on an edge at the projected point', () => {
        tool.onDown(ev(), { kind: 'handle', handle: 'edge', roomIdx: 0, edgeIdx: 0 }, { x: 200, y: 95 });
        expect(state.rooms[0].polygon.length).toBe(5);
        expect(state.rooms[0].polygon[1]).toEqual([20, 10]);
        expect(state.selectedVertex).toEqual({ roomIdx: 0, vertexIdx: 1 });
    });

    it('Alt-click deletes a corner but never below three', () => {
        tool.onDown(ev({ altKey: true }), { kind: 'handle', handle: 'vertex', roomIdx: 0, vertexIdx: 0 }, { x: 0, y: 0 });
        expect(state.rooms[0].polygon.length).toBe(3);
        tool.onDown(ev({ altKey: true }), { kind: 'handle', handle: 'vertex', roomIdx: 0, vertexIdx: 0 }, { x: 0, y: 0 });
        expect(state.rooms[0].polygon.length).toBe(3);
    });

    it('Shift-clicks collect polygon points; Enter makes a room and selects it; Escape cancels', () => {
        state.selectedRooms = [];
        tool.onDown(ev({ shiftKey: true }), { kind: 'bg' }, { x: 500, y: 500 });
        tool.onDown(ev({ shiftKey: true }), { kind: 'bg' }, { x: 700, y: 500 });
        tool.onDown(ev({ shiftKey: true }), { kind: 'bg' }, { x: 700, y: 700 });
        expect(state.drawingPolygon.length).toBe(3);
        tool.onKey({ key: 'Enter' });
        expect(state.rooms.length).toBe(2);
        expect(state.selectedRooms).toEqual([1]);
        expect(state.drawingPolygon).toBeNull();
        state.drawingPolygon = [[1, 1]];
        tool.onKey({ key: 'Escape' });
        expect(state.drawingPolygon).toBeNull();
    });

    it('rejects a degenerate polygon on Enter', () => {
        state.drawingPolygon = [[0, 0], [5, 0], [10, 0]];
        tool.onKey({ key: 'Enter' });
        expect(state.rooms.length).toBe(1);
        expect(state.drawingPolygon).toBeNull();
    });

    it('a tap selects the room under it (Ctrl toggles), a tap outside clears', () => {
        state.selectedRooms = [];
        tool.onClick(ev(), { kind: 'bg' }, { x: 200, y: 200 });
        expect(state.selectedRooms).toEqual([0]);
        tool.onClick(ev({ ctrlKey: true }), { kind: 'room', id: 'r' }, { x: 200, y: 200 });
        expect(state.selectedRooms).toEqual([]);
        state.selectedRooms = [0];
        tool.onClick(ev(), { kind: 'bg' }, { x: 900, y: 900 });
        expect(state.selectedRooms).toEqual([]);
    });
});

describe('WallTool', () => {
    let state, tool;
    beforeEach(() => {
        state = makeState({ activeLayer: 'walls', walls: [{ id: 'w', points: [[10, 10], [40, 10]], thickness: 8 }] });
        tool = new WallTool(canvas(), state);
    });

    it('drops snapped corners while drawing and commits on Enter', () => {
        state.drawingWall = [];
        tool.onDown(ev(), { kind: 'bg' }, { x: 100, y: 500 });
        tool.onDown(ev(), { kind: 'bg' }, { x: 400, y: 515 });   // slightly off-axis: snaps flat
        expect(state.drawingWall[1]).toEqual([40, 50]);
        tool.onKey({ key: 'Enter' });
        expect(state.walls.length).toBe(2);
        expect(state.drawingWall).toBeNull();
        expect(state.selectedWallIdx).toBe(1);
    });

    it('selects and moves a whole wall by the drag delta', () => {
        tool.onDown(ev(), { kind: 'wall', wallIdx: 0 }, { x: 200, y: 100 });
        tool.onMove(ev(), { x: 250, y: 150 });
        tool.onUp();
        expect(state.walls[0].points).toEqual([[15, 15], [45, 15]]);
        expect(state.selectedWallIdx).toBe(0);
        expect(state._saves).toBe(1);
    });
});

describe('HitTest helpers', () => {
    it('polygonArea and projectOnSegment', () => {
        expect(polygonArea([[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(100);
        expect(polygonArea([[0, 0], [1, 1]])).toBe(0);
        expect(projectOnSegment([5, 3], [0, 0], [10, 0])).toEqual({ x: 5, y: 0, t: 0.5 });
        expect(projectOnSegment([-5, 3], [0, 0], [10, 0]).t).toBe(0);
    });

    it('describeTarget reads the data attributes the scene and overlay set', () => {
        const svgNS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(svgNS, 'g');
        g.classList.add('shortcut-group');
        g.dataset.shortcutId = 'x';
        const inner = document.createElementNS(svgNS, 'circle');
        g.appendChild(inner);
        expect(describeTarget(inner)).toEqual({ kind: 'shortcut', id: 'x' });
        const h = document.createElementNS(svgNS, 'rect');
        h.dataset.handle = 'vertex'; h.dataset.roomIdx = '2'; h.dataset.vertexIdx = '3';
        expect(describeTarget(h)).toMatchObject({ kind: 'handle', handle: 'vertex', roomIdx: 2, vertexIdx: 3 });
        expect(describeTarget(null)).toEqual({ kind: 'bg' });
    });
});

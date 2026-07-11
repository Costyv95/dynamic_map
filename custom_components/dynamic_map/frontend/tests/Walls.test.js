import { describe, it, expect, vi } from 'vitest';
import { snapWallPoint, distToWall, hitsWall } from '../shared/WallGeometry.js';
import { EditorStateManager } from '../editor/EditorStateManager.js';
import '../custom-svg-map.js';

const svgNS = 'http://www.w3.org/2000/svg';

describe('wall geometry', () => {
    it('snaps nearly-horizontal and nearly-vertical segments to the axis', () => {
        // 1000x1000 map: 3% rise over 30% run is ~5.7 degrees -> snap flat
        expect(snapWallPoint([10, 50], [40, 53], 1000, 1000)).toEqual([40, 50]);
        expect(snapWallPoint([10, 10], [12, 40], 1000, 1000)).toEqual([10, 40]);
        // 45 degrees stays free
        expect(snapWallPoint([10, 10], [30, 30], 1000, 1000)).toEqual([30, 30]);
        // no previous point: nothing to snap against
        expect(snapWallPoint(null, [30, 30], 1000, 1000)).toEqual([30, 30]);
    });

    it('snapping respects a non-square canvas aspect', () => {
        // 2% of y over 10% of x: on a 1600x1000 canvas that is 20px/160px
        // (~7.1 deg -> snaps); on a square canvas 20px/100px (~11.3 deg -> free).
        expect(snapWallPoint([10, 50], [20, 52], 1600, 1000)).toEqual([20, 50]);
        expect(snapWallPoint([10, 50], [20, 52], 1000, 1000)).toEqual([20, 52]);
    });

    it('measures distance to the nearest segment of the run', () => {
        const wall = { points: [[0, 50], [50, 50], [50, 100]], thickness: 10 };
        // point above the middle of the first segment
        expect(distToWall(wall, 250, 480, 1000, 1000)).toBeCloseTo(20, 5);
        // hit test includes half thickness + slack
        expect(hitsWall(wall, 250, 490, 1000, 1000)).toBe(true);
        expect(hitsWall(wall, 250, 400, 1000, 1000)).toBe(false);
    });
});

describe('wall editor state', () => {
    it('walls travel through undo/redo', () => {
        const state = new EditorStateManager(vi.fn(), vi.fn());
        state.saveState(); // baseline: no walls
        state.walls = [{ id: 'w1', points: [[0, 0], [10, 0]], thickness: 8 }];
        state.saveState();
        state.undo();
        expect(state.walls).toEqual([]);
        state.redo();
        expect(state.walls.length).toBe(1);
        expect(state.walls[0].id).toBe('w1');
    });

    it('switching layers clears wall selection and drawing', () => {
        const state = new EditorStateManager(vi.fn(), vi.fn());
        state.activeLayer = 'walls';
        state.selectedWallIdx = 0;
        state.drawingWall = [[1, 1]];
        state.setActiveLayer('objects');
        expect(state.selectedWallIdx).toBe(-1);
        expect(state.drawingWall).toBeNull();
    });
});

describe('wall card rendering', () => {
    it('buildWalls strokes one clean path per wall under a non-interactive layer', () => {
        const card = document.createElement('custom-svg-map');
        card.imgW = 1000;
        card.imgH = 1000;
        card.mapRoot = document.createElementNS(svgNS, 'g');
        card.walls = [
            { points: [[10, 20], [50, 20], [50, 60]], thickness: 12, color: '#0f172a' },
            { points: [[0, 0], [10, 0]] }, // defaults
            { points: [[5, 5]] },          // degenerate: skipped
        ];
        card.buildWalls();

        const layer = card.mapRoot.querySelector('.dm-walls');
        expect(layer).toBeTruthy();
        expect(layer.style.pointerEvents).toBe('none');
        const paths = layer.querySelectorAll('path');
        expect(paths.length).toBe(2);
        expect(paths[0].getAttribute('d')).toBe('M 100.0 200.0 L 500.0 200.0 L 500.0 600.0');
        expect(paths[0].getAttribute('stroke')).toBe('#0f172a');
        expect(paths[0].getAttribute('stroke-width')).toBe('12');
        expect(paths[0].getAttribute('stroke-linejoin')).toBe('miter');
        expect(paths[1].getAttribute('stroke-width')).toBe('8');
    });

    it('no walls means no layer', () => {
        const card = document.createElement('custom-svg-map');
        card.imgW = 1000;
        card.imgH = 1000;
        card.mapRoot = document.createElementNS(svgNS, 'g');
        card.walls = [];
        card.buildWalls();
        expect(card.mapRoot.querySelector('.dm-walls')).toBeNull();
    });
});

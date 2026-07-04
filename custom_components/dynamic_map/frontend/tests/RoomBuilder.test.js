import { describe, it, expect, beforeEach } from 'vitest';
import { EditorInteractionManager } from '../editor/EditorInteractionManager.js';

// Minimal state stub mirroring the fields onKeyDown touches.
function makeState() {
    return {
        drawingPolygon: null,
        rooms: [],
        selectedRooms: [],
        selectedShortcutIdx: 0,
        _saves: 0,
        _uiUpdates: 0,
        _draws: 0,
        saveState() { this._saves++; },
        updateUICallback() { this._uiUpdates++; },
        requestDrawCallback() { this._draws++; }
    };
}

function makeManager(state) {
    const canvas = document.createElement('canvas');
    // engine is only used inside pointer/zoom handlers, not by onKeyDown or the constructor
    const engine = {};
    const im = new EditorInteractionManager(canvas, engine, state);
    return im;
}

describe('EditorInteractionManager.polygonArea', () => {
    it('computes the area of a 10x10 square as 100', () => {
        const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
        expect(EditorInteractionManager.polygonArea(sq)).toBeCloseTo(100, 6);
    });

    it('is orientation-independent (clockwise vs counter-clockwise)', () => {
        const cw = [[0, 0], [0, 10], [10, 10], [10, 0]];
        expect(EditorInteractionManager.polygonArea(cw)).toBeCloseTo(100, 6);
    });

    it('returns 0 for a degenerate (collinear) polygon', () => {
        const line = [[0, 0], [5, 0], [10, 0]];
        expect(EditorInteractionManager.polygonArea(line)).toBeCloseTo(0, 9);
    });

    it('returns 0 for fewer than 3 vertices', () => {
        expect(EditorInteractionManager.polygonArea([[0, 0], [1, 1]])).toBe(0);
        expect(EditorInteractionManager.polygonArea([])).toBe(0);
    });
});

describe('Room create flow (onKeyDown)', () => {
    let state, im;
    beforeEach(() => {
        state = makeState();
        im = makeManager(state);
    });

    it('Enter finalizes a valid polygon into a room and auto-selects it', () => {
        state.drawingPolygon = [[10, 10], [30, 10], [30, 30], [10, 30]];
        im.onKeyDown({ key: 'Enter' });

        expect(state.rooms).toHaveLength(1);
        const room = state.rooms[0];
        expect(room.name).toBe('New Room');
        expect(room.polygon).toHaveLength(4);
        expect(room.id).toMatch(/^room_/);
        // Auto-selected so the Name/Area panel opens immediately
        expect(state.selectedRooms).toEqual([0]);
        expect(state.selectedShortcutIdx).toBe(-1);
        // Drawing buffer cleared and history + UI updated
        expect(state.drawingPolygon).toBeNull();
        expect(state._saves).toBe(1);
        expect(state._uiUpdates).toBe(1);
    });

    it('Enter rejects a degenerate (zero-area) polygon without creating a room', () => {
        state.drawingPolygon = [[0, 0], [5, 0], [10, 0]]; // collinear
        im.onKeyDown({ key: 'Enter' });

        expect(state.rooms).toHaveLength(0);
        expect(state.drawingPolygon).toBeNull();
        expect(state._saves).toBe(0);
    });

    it('Enter with fewer than 3 points does nothing', () => {
        state.drawingPolygon = [[0, 0], [10, 10]];
        im.onKeyDown({ key: 'Enter' });
        expect(state.rooms).toHaveLength(0);
        expect(state.drawingPolygon).toHaveLength(2); // left intact
    });

    it('Escape cancels an in-progress drawing without creating a room', () => {
        state.drawingPolygon = [[0, 0], [10, 0], [10, 10]];
        im.onKeyDown({ key: 'Escape' });
        expect(state.rooms).toHaveLength(0);
        expect(state.drawingPolygon).toBeNull();
    });
});

describe('Room area binding round-trip', () => {
    it('a room object preserves area_id through JSON serialization (save/load)', () => {
        const room = { id: 'room_1', name: 'Balcony', polygon: [[0, 0], [1, 0], [1, 1]], color: '#334455', area_id: 'terrace_area' };
        const restored = JSON.parse(JSON.stringify([room]))[0];
        expect(restored.area_id).toBe('terrace_area');
        expect(restored.name).toBe('Balcony');
    });
});

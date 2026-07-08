import { describe, it, expect } from 'vitest';
import { resizeCursorFor } from '../editor/EditorInteractionManager.js';

// Local handle directions (x right, y down): N up, E right, corners diagonal.
const N = [0, -1], S = [0, 1], E = [1, 0], W = [-1, 0];
const NE = [1, -1], NW = [-1, -1], SE = [1, 1], SW = [-1, 1];

describe('resizeCursorFor', () => {
    it('unrotated: N/S vertical, E/W horizontal, corners diagonal', () => {
        expect(resizeCursorFor(...N, 0)).toBe('ns-resize');
        expect(resizeCursorFor(...S, 0)).toBe('ns-resize');
        expect(resizeCursorFor(...E, 0)).toBe('ew-resize');
        expect(resizeCursorFor(...W, 0)).toBe('ew-resize');
        expect(resizeCursorFor(...SE, 0)).toBe('nwse-resize');
        expect(resizeCursorFor(...NW, 0)).toBe('nwse-resize');
        expect(resizeCursorFor(...NE, 0)).toBe('nesw-resize');
        expect(resizeCursorFor(...SW, 0)).toBe('nesw-resize');
    });

    it('map rotated -90: N/S read horizontal, E/W read vertical', () => {
        expect(resizeCursorFor(...N, -90)).toBe('ew-resize');
        expect(resizeCursorFor(...E, -90)).toBe('ns-resize');
        // diagonals swap under a 90deg turn
        expect(resizeCursorFor(...SE, -90)).toBe('nesw-resize');
        expect(resizeCursorFor(...NE, -90)).toBe('nwse-resize');
    });

    it('shortcut rotated 90 (its own rotation) behaves like a quarter turn', () => {
        expect(resizeCursorFor(...N, 90)).toBe('ew-resize');
        expect(resizeCursorFor(...E, 90)).toBe('ns-resize');
    });

    it('map rotated AND shortcut rotated 90 cancel back to axis-aligned', () => {
        expect(resizeCursorFor(...N, -90 + 90)).toBe('ns-resize');
        expect(resizeCursorFor(...E, -90 + 90)).toBe('ew-resize');
    });

    it('a single mirror swaps the diagonals but not the axes', () => {
        expect(resizeCursorFor(...SE, 0, -1, 1)).toBe('nesw-resize'); // was nwse
        expect(resizeCursorFor(...NE, 0, -1, 1)).toBe('nwse-resize'); // was nesw
        expect(resizeCursorFor(...N, 0, -1, 1)).toBe('ns-resize');    // unchanged
        expect(resizeCursorFor(...E, 0, -1, 1)).toBe('ew-resize');    // unchanged
    });

    it('a double mirror (180) leaves everything unchanged', () => {
        expect(resizeCursorFor(...SE, 0, -1, -1)).toBe('nwse-resize');
        expect(resizeCursorFor(...N, 0, -1, -1)).toBe('ns-resize');
    });

    it('45-degree rotation lands cleanly in a diagonal bucket', () => {
        // N rotated 45 -> points up-left-ish -> diagonal
        expect(['nwse-resize', 'nesw-resize']).toContain(resizeCursorFor(...N, 45));
    });
});

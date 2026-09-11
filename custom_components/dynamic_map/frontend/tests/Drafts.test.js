import { describe, it, expect } from 'vitest';
import { writeDraft, readDraft, clearDraft, draftDiffers, formatAge, DirtyTracker } from '../editor/Drafts.js';
import { typicalScale } from '../editor/ui/AreaImport.js';

function memStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('drafts', () => {
    it('round-trips a floor draft without runtime keys', () => {
        const st = memStorage();
        writeDraft(2, { rooms: [{ id: 'r', _expanded: true }], shortcuts: [{ id: 's', config: { actions: [{ _expanded: true, type: 'TOGGLE' }] } }], walls: [], config: { rotation_mode: 'auto' } }, st);
        const d = readDraft(2, st);
        expect(d.rooms).toEqual([{ id: 'r' }]);
        expect(d.shortcuts[0].config.actions[0]).toEqual({ type: 'TOGGLE' });
        expect(d.ts).toBeGreaterThan(0);
        clearDraft(2, st);
        expect(readDraft(2, st)).toBeNull();
        expect(readDraft(9, st)).toBeNull();
    });

    it('only reports a difference when the draft diverges from the server data', () => {
        const data = { rooms: [{ id: 'r' }], shortcuts: [{ id: 's', _expanded: true }], config: { walls: [] } };
        expect(draftDiffers(null, data)).toBe(false);
        expect(draftDiffers({ rooms: [{ id: 'r' }], shortcuts: [{ id: 's' }], walls: [] }, data)).toBe(false);
        expect(draftDiffers({ rooms: [{ id: 'r' }], shortcuts: [{ id: 's', name: 'x' }], walls: [] }, data)).toBe(true);
    });

    it('formats ages and tracks dirtiness', () => {
        const now = 1_000_000_000;
        expect(formatAge(now - 30_000, now)).toBe('30s ago');
        expect(formatAge(now - 5 * 60_000, now)).toBe('5 min ago');
        const t = new DirtyTracker();
        const seen = [];
        t.onChange(d => seen.push(d));
        expect(t.dirty).toBe(false);
        t.bump();
        expect(t.dirty).toBe(true);
        t.markSaved();
        expect(t.dirty).toBe(false);
        expect(seen).toEqual([true, false]);
    });
});

describe('typicalScale', () => {
    it('takes the median of existing badge scales, defaulting to 3', () => {
        expect(typicalScale([])).toBe(3);
        expect(typicalScale([{ scaleX: 2 }, { scaleX: { horizontal: 5, vertical: 5 } }, { scale: 4 }])).toBe(4);
    });
});

import { describe, it, expect } from 'vitest';
import { choreState, choreLevel } from '../card/Chores.js';

describe('chore freshness', () => {
    const at = (d) => new Date(`${d}T12:00:00`);
    it("takes Crumbs' state when present", () => {
        ['done', 'ok', 'soon', 'late'].forEach(st => expect(choreState({ state: st, late_days: 9 })).toBe(st));
    });
    it('derives it from the rhythm on older sensors: first 20% done, last 20% soon, past due late', () => {
        const c = (last, extra = {}) => ({ last_done: last, every_days: 10, due: false, late_days: 0, ...extra });
        expect(choreState(c('2026-11-19'), at('2026-11-20'))).toBe('done');
        expect(choreState(c('2026-11-15'), at('2026-11-20'))).toBe('ok');
        expect(choreState(c('2026-11-11'), at('2026-11-20'))).toBe('soon');
        expect(choreState(c('2026-11-10', { due: true }), at('2026-11-20'))).toBe('soon');
        expect(choreState(c('2026-11-01', { late_days: 9 }), at('2026-11-20'))).toBe('late');
        expect(choreState({ title: 'One-off', due_on: '2026-12-01' }, at('2026-11-20'))).toBe('ok');
    });
    it('tints a room by its area state when Crumbs sends one', () => {
        expect(['late', 'soon', 'ok', 'done'].map(state => choreLevel({ state, overdue: 0, due: 0 }))).toEqual(['overdue', 'due', 'calm', 'calm']);
    });
});

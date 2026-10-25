import { describe, it, expect, vi, afterEach } from 'vitest';
import { OverlayManager } from '../card/OverlayManager.js';

function card() {
    const renderRoot = document.createElement('div');
    renderRoot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 800 });
    document.body.appendChild(renderRoot);
    return { _hass: { states: {}, callService: vi.fn() }, renderRoot, activeOverlay: null, shortcutElements: {}, rooms: [] };
}

function open(mapContext) {
    OverlayManager.showActionMenu(mapContext, { sc: { entity_id: 'light.desk', config: {} } },
        [{ type: 'TOGGLE', name: 'Desk' }], { clientX: 200, clientY: 300 });
    mapContext.renderRoot.appendChild(mapContext.activeOverlay);
    return mapContext.activeOverlay;
}

const tap = (el) => el.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));

describe('long-press menu closes on an outside tap', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    afterEach(() => { document.body.innerHTML = ''; });

    it('ignores the opening press, keeps inside taps, closes on a later outside tap', () => {
        const ctx = card();
        const ov = open(ctx);
        tap(document.body);
        expect(ctx.activeOverlay).toBe(ov);
        now += 100;
        tap(ov);
        expect(ctx.activeOverlay).toBe(ov);
        tap(document.body);
        expect(ctx.activeOverlay).toBe(null);
        expect(ctx._outsideTap).toBe(null);
    });

    it('reopening replaces the listener instead of stacking another', () => {
        const ctx = card();
        const add = vi.spyOn(document, 'addEventListener');
        const remove = vi.spyOn(document, 'removeEventListener');
        open(ctx);
        const first = ctx._outsideTap;
        open(ctx);
        expect(remove).toHaveBeenCalledWith('pointerdown', first);
        expect(add.mock.calls.filter(c => c[0] === 'pointerdown')).toHaveLength(2);
        add.mockRestore();
        remove.mockRestore();
    });
});

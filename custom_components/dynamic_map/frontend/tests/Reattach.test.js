import { describe, it, expect, vi, afterEach } from 'vitest';
import '../custom-svg-map.js';

globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} disconnect() {} };

// HA keeps a view's card elements and re-attaches them on a view switch (#1736).
const json = (body) => ({ ok: true, json: async () => body, text: async () => JSON.stringify(body) });
const ROOMS = [{ id: 'r1', name: 'Hall', polygon: [[10, 10], [60, 10], [60, 60], [10, 60]] }];
const CONFIG = { canvas: { w: 1000, h: 1000 }, walls: [] };

async function builtCard() {
    global.fetch = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('rooms_floor1')) return json(ROOMS);
        if (u.includes('config_floor1')) return json(CONFIG);
        if (u.includes('shortcuts_floor1')) return json([]);
        return { ok: false, json: async () => ({}), text: async () => '' };
    });
    const card = document.createElement('custom-svg-map');
    document.body.appendChild(card);
    const built = card.whenBuilt();
    card.setConfig({ floors: [1] });
    await built;
    card.svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 500 });
    return card;
}

const wheel = (card) => card.svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, clientX: 250, clientY: 250, cancelable: true }));

describe('card detached and re-attached', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('still zooms on wheel and runs the effects loop', async () => {
        const card = await builtCard();
        expect(card.animationFrame).not.toBe(null);
        card.remove();
        expect(card.animationFrame).toBe(null);   // no loop while off the page
        document.body.appendChild(card);
        expect(card.cameraManager).toBeTruthy();
        expect(card.animationFrame).not.toBe(null);
        const before = card.vb.w;
        wheel(card);
        expect(card.vb.w).toBeLessThan(before);
        card.remove();
    });
});

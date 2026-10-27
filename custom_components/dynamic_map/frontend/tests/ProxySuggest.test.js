import { describe, it, expect, vi } from 'vitest';
import { EditorStateManager } from '../editor/EditorStateManager.js';
import { ProxyTool } from '../editor/tools/ProxyTool.js';
import { suggestedProxies } from '../editor/ProxySuggest.js';

const canvas = { imgW: 1000, imgH: 1000, toPercent: (x, y) => [x / 10, y / 10] };
const OFFICE = { id: 'b4:bf:e9:c9:bd:38', name: 'Office Proxy', online: true, area: 'office' };
const ROOMS = [{ name: 'Office', area_id: 'office', polygon: [[40, 60], [80, 60], [80, 80], [40, 80]] }];

function state() {
    const s = new EditorStateManager(vi.fn(), vi.fn());
    s.activeLayer = 'proxies';
    s.rooms = ROOMS;
    s.knownProxies = [OFFICE];
    s.saveState();
    return s;
}

describe('unplaced proxies suggested in their room', () => {
    it('an unplaced proxy shows in the middle of its area room; placed, foreign-floor or area-less ones do not', () => {
        expect(suggestedProxies([OFFICE], [], ROOMS)).toEqual([{ id: OFFICE.id, name: 'Office Proxy', position: [60, 70], suggested: true }]);
        expect(suggestedProxies([OFFICE], [{ id: OFFICE.id, position: [1, 1] }], ROOMS)).toEqual([]);
        expect(suggestedProxies([{ ...OFFICE, area: 'bedroom' }], [], ROOMS)).toEqual([]);
        expect(suggestedProxies([{ ...OFFICE, area: null }], [], ROOMS)).toEqual([]);
    });

    it('dragging a suggestion places it where it is dropped, one undo step', () => {
        const s = state();
        const tool = new ProxyTool(canvas, s);
        expect(tool.onDown({}, { kind: 'handle', handle: 'proxy', proxyId: OFFICE.id })).toBe(true);
        tool.onMove({}, { x: 712, y: 655 });
        tool.onUp();
        expect(s.proxies).toEqual([{ id: OFFICE.id, name: 'Office Proxy', position: [71.2, 65.5] }]);
        s.undo();
        expect(s.proxies).toEqual([]);
    });

    it('a tap on a suggestion keeps it at the suggested spot', () => {
        const s = state();
        const tool = new ProxyTool(canvas, s);
        tool.onDown({}, { kind: 'handle', handle: 'proxy', proxyId: OFFICE.id });
        tool.onUp();
        expect(s.proxies).toEqual([{ id: OFFICE.id, name: 'Office Proxy', position: [60, 70] }]);
    });
});

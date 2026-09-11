import { describe, it, expect, vi } from 'vitest';
import { isTyping, realTarget, deepActiveElement } from '../editor/Keys.js';
import { ToolRouter } from '../editor/ToolRouter.js';
import { openShortcutsHelp } from '../editor/ui/HelpDialog.js';

function makeState() {
    return {
        shortcuts: [{ id: 'a', position: [50, 50], config: {} }], rooms: [], walls: [], selectedShortcutIdx: 0, selectedExtra: [], selectedRooms: [], selectedWallIdx: -1,
        previewStateIdx: -1, isEditMode: true, activeLayer: 'objects', drawingPolygon: null, drawingWall: null,
        selectionIndices() { return [0]; }, saveState: vi.fn(), updateUICallback: vi.fn(), requestDrawCallback: vi.fn(), deleteSelection: vi.fn(() => true)
    };
}
function makeRouter(state) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    const c = { imgW: 1000, imgH: 1000, activeMode: 'horizontal', isRotated: false, linkOrientations: true, pxPerUnit: () => 1, _hass: null, svg,
        camera: { pointerDown() {}, pointerMove() { return false; }, pointerUp() { return false; }, startPan() {}, pointers: new Map(), pinch: null }, clientToMap: (x, y) => ({ x, y }) };
    return new ToolRouter(c, state);
}

describe('typing detection through shadow roots', () => {
    it('resolves the real target from the composed path and the deep active element', () => {
        const host = document.createElement('div');
        const sr = host.attachShadow({ mode: 'open' });
        const input = document.createElement('input');
        sr.appendChild(input);
        document.body.appendChild(host);
        input.focus();
        expect(deepActiveElement()).toBe(input);
        const e = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true });
        let seen;
        // composedPath() is only populated while the event is dispatching, so inspect it in the listener.
        document.addEventListener('keydown', (ev) => { seen = { target: ev.target, real: realTarget(ev), typing: isTyping(ev) }; }, { once: true });
        input.dispatchEvent(e);
        expect(seen.target).toBe(host);            // retargeted at document level
        expect(seen.real).toBe(input);
        expect(seen.typing).toBe(true);
        host.remove();   // nothing focused any more: the map owns the keys again
        expect(isTyping({ target: document.body, composedPath: () => [document.body] })).toBe(false);
    });

    it('Delete and arrows typed in a shadow-root textbox leave the selection alone', () => {
        const state = makeState();
        makeRouter(state);
        const host = document.createElement('div');
        const sr = host.attachShadow({ mode: 'open' });
        const input = document.createElement('input');
        sr.appendChild(input);
        document.body.appendChild(host);
        input.focus();
        ['Delete', 'Backspace', 'ArrowLeft', 'ArrowRight', ' '].forEach(key => input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true })));
        expect(state.deleteSelection).not.toHaveBeenCalled();
        expect(state.shortcuts[0].position).toEqual([50, 50]);
        host.remove();
        // The same keys on the map do act.
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        expect(state.deleteSelection).toHaveBeenCalled();
    });

    it('? opens the shortcut reference (not while typing)', () => {
        const state = makeState();
        makeRouter(state);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
        const dlg = document.querySelector('.dm-dialog');
        expect(dlg.textContent).toContain('Keyboard & mouse');
        expect(dlg.querySelectorAll('kbd').length).toBeGreaterThan(10);
        dlg.querySelector('button.primary').click();
        expect(document.querySelector('.dm-dialog')).toBeNull();
        expect(typeof openShortcutsHelp).toBe('function');
    });
});

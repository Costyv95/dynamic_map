import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OverlayManager } from '../card/OverlayManager.js';

/**
 * Render-level cover for PROGRESS_BAR through the real long-press menu path,
 * so the DOM shape and the confirm-then-run tap stay honest (the pure model is
 * covered separately in ProgressBar.test.js).
 */
function showMenu(actions, states = {}) {
    const hass = { states, callService: vi.fn(() => Promise.resolve()) };
    const renderRoot = document.createElement('div');
    document.body.appendChild(renderRoot);
    renderRoot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

    const mapContext = { _hass: hass, renderRoot, activeOverlay: null, shortcutElements: {}, rooms: [] };
    const shortcut = { sc: { entity_id: 'vacuum.saros_20x', config: { menuWidth: 200, menuHeight: 414 } } };

    OverlayManager.showActionMenu(mapContext, shortcut, actions, { clientX: 100, clientY: 100 });
    return { overlay: mapContext.activeOverlay, hass };
}

const BAR = {
    type: 'PROGRESS_BAR',
    action_entity: 'sensor.saros_20x_main_brush_time_left',
    name: 'Main brush',
    min: 0,
    max: 300,
    decimals: 0,
    pos_x: 11,
    pos_y: 200,
    width: '180',
    height: 28,
    service: 'button.press',
    payload: '{"entity_id": "button.saros_20x_reset_main_brush_consumable"}',
};

const STATES = {
    'sensor.saros_20x_main_brush_time_left': {
        state: '150', attributes: { unit_of_measurement: 'h' }
    },
};

describe('PROGRESS_BAR rendering', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

    it('draws a filled track and the value, positioned where configured', () => {
        const { overlay } = showMenu([BAR], STATES);
        const wrap = overlay.lastChild;
        expect(wrap.style.left).toBe('11px');
        expect(wrap.style.top).toBe('200px');
        expect(wrap.style.width).toBe('180px');
        expect(overlay.textContent).toContain('Main brush');
        expect(overlay.textContent).toContain('150 h');

        // fill animates in on a timer
        const fill = wrap.querySelector('div[style*="border-radius"] > div');
        expect(fill.style.width).toBe('0%');
        vi.advanceTimersByTime(100);
        expect(fill.style.width).toBe('50%');
        expect(fill.style.background).toBe('rgb(16, 185, 129)'); // healthy green
    });

    it('needs two taps to fire the reset service', () => {
        const { overlay, hass } = showMenu([BAR], STATES);
        const wrap = overlay.lastChild;

        wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(hass.callService).not.toHaveBeenCalled();
        expect(overlay.textContent).toContain('Tap again to confirm');

        wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(hass.callService).toHaveBeenCalledWith('button', 'press', {
            entity_id: 'button.saros_20x_reset_main_brush_consumable'
        });
    });

    it('disarms itself if the confirm tap never comes', () => {
        const { overlay, hass } = showMenu([BAR], STATES);
        const wrap = overlay.lastChild;

        wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        vi.advanceTimersByTime(5000);
        expect(overlay.textContent).toContain('Main brush');
        expect(overlay.textContent).not.toContain('Tap again');

        wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(hass.callService).not.toHaveBeenCalled();
    });

    it('a bar with no service is inert', () => {
        const { overlay, hass } = showMenu([{ ...BAR, service: undefined, payload: undefined }], STATES);
        overlay.lastChild.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        vi.advanceTimersByTime(100);
        expect(hass.callService).not.toHaveBeenCalled();
    });

    it('renders an empty bar for an unknown reading rather than breaking', () => {
        const { overlay } = showMenu([BAR], {
            'sensor.saros_20x_main_brush_time_left': { state: 'unknown', attributes: {} }
        });
        expect(overlay.textContent).toContain('--');
        vi.advanceTimersByTime(100);
        const fill = overlay.lastChild.querySelector('div[style*="border-radius"] > div');
        expect(fill.style.width).toBe('0%');
    });
});

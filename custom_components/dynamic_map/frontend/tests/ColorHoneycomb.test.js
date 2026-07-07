import { describe, it, expect, vi } from 'vitest';
import { OverlayManager } from '../card/OverlayManager.js';

describe('COLOR_PICKER honeycomb', () => {
    function build(act = {}) {
        const hass = { states: {}, callService: vi.fn() };
        const mapContext = { _hass: hass };
        const wrap = OverlayManager.buildColorHoneycomb(mapContext, 'light.light_strip', act);
        const grid = wrap.querySelector('div[style*="position: relative"], div');
        const cells = wrap.querySelectorAll('div[style*="clip-path"], div');
        return { wrap, hass, cells: [...wrap.querySelectorAll('div')].filter(d => d.style.clipPath) };
    }

    it('renders 19 hexagonal swatches (1 + 6 + 12)', () => {
        const { cells } = build();
        expect(cells.length).toBe(19);
        cells.forEach(c => expect(c.style.clipPath).toContain('polygon'));
    });

    it('center swatch is warm white and clicking turns the light on with that rgb_color', () => {
        const { cells, hass } = build();
        const center = cells[0];
        expect(center.style.background).toBe('rgb(255, 241, 224)');
        center.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(hass.callService).toHaveBeenCalledWith('light', 'turn_on', {
            entity_id: 'light.light_strip',
            rgb_color: [255, 241, 224]
        });
    });

    it('outer swatches send saturated distinct colors', () => {
        const { cells, hass } = build();
        const colors = new Set(cells.map(c => c.style.background));
        // all 19 swatches are distinct colors
        expect(colors.size).toBe(19);
        cells[7].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const args = hass.callService.mock.calls[0][2];
        expect(args.rgb_color).toHaveLength(3);
        args.rgb_color.forEach(v => {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(255);
        });
    });

    it('shows a label when the action has a name', () => {
        const { wrap } = build({ name: 'Strip Color' });
        expect(wrap.textContent).toContain('Strip Color');
    });

    it('does not call services without hass', () => {
        const mapContext = { _hass: null };
        const wrap = OverlayManager.buildColorHoneycomb(mapContext, 'light.x', {});
        const cell = [...wrap.querySelectorAll('div')].find(d => d.style.clipPath);
        expect(() => cell.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow();
    });
});

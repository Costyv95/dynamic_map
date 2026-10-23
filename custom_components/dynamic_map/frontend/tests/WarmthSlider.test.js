import { describe, it, expect, vi } from 'vitest';
import { warmthRange, buildWarmthSlider } from '../card/overlay/sliders.js';
import { buildColorHoneycomb } from '../card/overlay/colorHoneycomb.js';
import { OverlayManager } from '../card/OverlayManager.js';

const lamp = (attrs) => ({ states: { 'light.lamp': { state: 'on', attributes: attrs } }, callService: vi.fn() });

describe('WARMTH slider', () => {
    it("spans the light's own kelvin range and starts at its current warmth", () => {
        expect(warmthRange(lamp({ min_color_temp_kelvin: 2202, max_color_temp_kelvin: 4000, color_temp_kelvin: 2702 }), 'light.lamp'))
            .toEqual({ min: 2202, max: 4000, value: 2702 });
        // In colour mode the light reports no kelvin: start in the middle.
        expect(warmthRange(lamp({ min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6000, color_temp_kelvin: null }), 'light.lamp').value).toBe(4000);
    });

    it('sets color_temp_kelvin on change, and the menu builds it', () => {
        const hass = lamp({ min_color_temp_kelvin: 2202, max_color_temp_kelvin: 4000, color_temp_kelvin: 3000 });
        const ctx = { _hass: hass };
        const el = buildWarmthSlider(ctx, 'light.lamp', { type: 'WARMTH' }, false);
        expect(el.textContent).toContain('Warmth');
        const range = el.querySelector('input');
        range.value = '2500';
        range.dispatchEvent(new Event('change'));
        expect(hass.callService).toHaveBeenCalledWith('light', 'turn_on', { entity_id: 'light.lamp', color_temp_kelvin: 2500 });

        const host = { _hass: hass, renderRoot: document.createElement('div'), isNarrow: false, activeOverlay: null };
        OverlayManager.showActionMenu(host, { sc: { entity_id: 'light.lamp', config: {} } }, [{ type: 'WARMTH', action_entity: 'light.lamp' }], { clientX: 10, clientY: 10 });
        expect(host.activeOverlay.querySelector('.dm-ov-warmth')).not.toBeNull();
    });

    it('a colour honeycomb in a designed menu sits at its saved position', () => {
        const wrap = buildColorHoneycomb({ _hass: null }, 'light.lamp', { type: 'COLOR_PICKER', pos_x: 11, pos_y: 102, width: 180 }, true);
        expect([wrap.style.position, wrap.style.left, wrap.style.top]).toEqual(['absolute', '11px', '102px']);
        expect(buildColorHoneycomb({ _hass: null }, 'light.lamp', { type: 'COLOR_PICKER' }, false).style.position).toBe('');
    });
});

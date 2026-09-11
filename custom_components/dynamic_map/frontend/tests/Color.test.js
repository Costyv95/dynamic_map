import { describe, it, expect } from 'vitest';
import { parseColor, shiftHue, contrastText, resolveEntityColor, isTransparentFill } from '../shared/Color.js';

describe('Color helpers', () => {
    it('parses hex and rgb() strings', () => {
        expect(parseColor('#ff0080')).toEqual([255, 0, 128]);
        expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
        expect(parseColor('red')).toBeNull();
        expect(parseColor(undefined)).toBeNull();
    });

    it('shifts hue and leaves unknown formats alone', () => {
        expect(shiftHue('#ff0000', 120)).toBe('rgb(0, 255, 0)');
        expect(shiftHue('rgb(0, 255, 0)', 120)).toBe('rgb(0, 0, 255)');
        expect(shiftHue('hsl(1,2%,3%)', 90)).toBe('hsl(1,2%,3%)');
    });

    it('picks dark text on light backgrounds and white otherwise', () => {
        expect(contrastText('#ffffff')).toBe('#1e293b');
        expect(contrastText('#0ea5e9')).toBe('#ffffff');
        expect(contrastText('nonsense')).toBe('#ffffff');
    });

    it("resolves 'entity' from rgb_color with an amber fallback", () => {
        const hass = { states: { 'light.a': { attributes: { rgb_color: [10, 20, 30] } }, 'light.b': { attributes: {} } } };
        expect(resolveEntityColor('entity', hass, 'light.a')).toBe('rgb(10, 20, 30)');
        expect(resolveEntityColor('entity', hass, 'light.b')).toBe('#f59e0b');
        expect(resolveEntityColor('#123456', hass, 'light.a')).toBe('#123456');
    });

    it('detects transparent fills', () => {
        expect(isTransparentFill('rgba(0,0,0,0)')).toBe(true);
        expect(isTransparentFill('none')).toBe(true);
        expect(isTransparentFill('')).toBe(true);
        expect(isTransparentFill('#fff')).toBe(false);
    });
});

import { describe, it, expect } from 'vitest';
import { MapShortcut } from '../shortcuts/MapShortcut.js';

describe("'entity' color sentinel", () => {
    const resolve = (color, hass, ctx = {}) => MapShortcut.prototype._resolveColor.call(
        { sc: { entity_id: 'light.light_strip' }, config: {}, ...ctx },
        color,
        hass
    );

    it('passes plain colors through untouched', () => {
        expect(resolve('#ff0000', null)).toBe('#ff0000');
        expect(resolve(undefined, null)).toBeUndefined();
    });

    it("resolves 'entity' to the bound light's live rgb_color", () => {
        const hass = { states: { 'light.light_strip': { state: 'on', attributes: { rgb_color: [12, 200, 99] } } } };
        expect(resolve('entity', hass)).toBe('rgb(12, 200, 99)');
    });

    it('falls back to amber when the entity has no rgb_color', () => {
        const hass = { states: { 'light.light_strip': { state: 'on', attributes: {} } } };
        expect(resolve('entity', hass)).toBe('#f59e0b');
        expect(resolve('entity', null)).toBe('#f59e0b');
    });

    it('uses config.state_entity when the shortcut has no entity_id', () => {
        const hass = { states: { 'light.other': { state: 'on', attributes: { rgb_color: [1, 2, 3] } } } };
        expect(resolve('entity', hass, { sc: {}, config: { state_entity: 'light.other' } })).toBe('rgb(1, 2, 3)');
    });
});

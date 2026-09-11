import { describe, it, expect } from 'vitest';
import { collectEntities, snapshotStates, statesChanged } from '../shortcuts/ShortcutDeps.js';
import { MapShortcut } from '../shortcuts/MapShortcut.js';

const svgNS = 'http://www.w3.org/2000/svg';

describe('collectEntities', () => {
    it('finds the top-level entity, config entities, condition entities and template references', () => {
        const sc = {
            entity_id: 'light.a',
            config: {
                temperature_entity: 'sensor.t',
                value_template: "{states('sensor.x')} and {states('sensor.y')}",
                states: [{ conditions: [{ state_entity: 'binary_sensor.door', operator: '==', value: 'on' }] }],
                actions: [{ action_entity: 'switch.b' }]
            }
        };
        expect(collectEntities(sc)).toEqual([
            'binary_sensor.door', 'light.a', 'sensor.t', 'sensor.x', 'sensor.y', 'switch.b'
        ]);
    });

    it('ignores non-entity strings and handles missing config', () => {
        expect(collectEntities({ config: { name: 'lamp', icon: '💡' } })).toEqual([]);
        expect(collectEntities({})).toEqual([]);
    });
});

describe('snapshot / changed', () => {
    it('reports a change only when a tracked state object is replaced', () => {
        const a = { state: 'on' };
        const hass = { states: { 'light.a': a, 'light.z': { state: 'off' } } };
        const snap = snapshotStates(['light.a'], hass);
        expect(statesChanged(['light.a'], snap, hass)).toBe(false);
        hass.states['light.z'] = { state: 'on' };
        expect(statesChanged(['light.a'], snap, hass)).toBe(false);
        hass.states['light.a'] = { state: 'off' };
        expect(statesChanged(['light.a'], snap, hass)).toBe(true);
        expect(statesChanged(['light.a'], null, hass)).toBe(true);
    });
});

describe('MapShortcut skipUnchanged', () => {
    function make(ctx) {
        return new MapShortcut({ id: 's', type: 'light', entity_id: 'light.a', position: [10, 10], config: {} }, svgNS, 1000, 1000, ctx);
    }

    it('re-renders on every call without the flag', () => {
        const sc = make({ activeMode: 'horizontal' });
        const hass = { states: { 'light.a': { state: 'on' } } };
        expect(sc.updateState(hass)).toBe(true);
        expect(sc.updateState(hass)).toBe(true);
    });

    it('skips unchanged ticks with the flag and re-renders after a change or invalidate()', () => {
        const sc = make({ activeMode: 'horizontal', skipUnchanged: true });
        const hass = { states: { 'light.a': { state: 'on' }, 'sensor.other': { state: '1' } } };
        expect(sc.updateState(hass)).toBe(true);
        hass.states['sensor.other'] = { state: '2' };
        expect(sc.updateState(hass)).toBe(false);
        hass.states['light.a'] = { state: 'off' };
        expect(sc.updateState(hass)).toBe(true);
        expect(sc.updateState(hass)).toBe(false);
        sc.invalidate();
        expect(sc.updateState(hass)).toBe(true);
    });

    it('re-renders when the orientation mode flips', () => {
        const ctx = { activeMode: 'horizontal', skipUnchanged: true };
        const sc = make(ctx);
        const hass = { states: { 'light.a': { state: 'on' } } };
        sc.updateState(hass);
        ctx.activeMode = 'vertical';
        expect(sc.updateState(hass)).toBe(true);
    });
});

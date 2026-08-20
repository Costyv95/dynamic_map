import { describe, it, expect } from 'vitest';
import { computeProgressBar, pickColor, DEFAULT_THRESHOLDS } from '../shared/ProgressBar.js';

const hassWith = (states) => ({ states });

describe('computeProgressBar', () => {
    it('maps a value onto 0-100 across an explicit range', () => {
        const bar = computeProgressBar({
            act: { action_entity: 'sensor.brush', min: 0, max: 300 },
            hass: hassWith({ 'sensor.brush': { state: '150', attributes: {} } })
        });
        expect(bar.available).toBe(true);
        expect(bar.pct).toBeCloseTo(50);
    });

    it('defaults the range to 0-100', () => {
        const bar = computeProgressBar({
            act: {},
            target: 'sensor.pct',
            hass: hassWith({ 'sensor.pct': { state: '42', attributes: {} } })
        });
        expect(bar.pct).toBeCloseTo(42);
    });

    it('clamps out-of-range readings instead of overflowing the track', () => {
        const over = computeProgressBar({
            act: { max: 10 }, target: 's.x',
            hass: hassWith({ 's.x': { state: '99', attributes: {} } })
        });
        const under = computeProgressBar({
            act: { min: 50, max: 100 }, target: 's.x',
            hass: hassWith({ 's.x': { state: '0', attributes: {} } })
        });
        expect(over.pct).toBe(100);
        expect(under.pct).toBe(0);
    });

    it('never divides by zero when min === max', () => {
        const bar = computeProgressBar({
            act: { min: 5, max: 5 }, target: 's.x',
            hass: hassWith({ 's.x': { state: '5', attributes: {} } })
        });
        expect(Number.isFinite(bar.pct)).toBe(true);
    });

    it('reads an attribute instead of the state when asked', () => {
        const bar = computeProgressBar({
            act: { attribute: 'battery_level' }, target: 'vacuum.saros',
            hass: hassWith({ 'vacuum.saros': { state: 'docked', attributes: { battery_level: 80 } } })
        });
        expect(bar.pct).toBeCloseTo(80);
        expect(bar.valueStr).toBe('80');
    });

    it('takes the max from another entity or from an attribute', () => {
        const hass = hassWith({
            'sensor.used': { state: '25', attributes: { total: 50 } },
            'sensor.total': { state: '200', attributes: {} }
        });
        expect(computeProgressBar({ act: { max: 'sensor.total' }, target: 'sensor.used', hass }).pct)
            .toBeCloseTo(12.5);
        expect(computeProgressBar({ act: { max: 'attribute:total' }, target: 'sensor.used', hass }).pct)
            .toBeCloseTo(50);
    });

    it('degrades to an empty grey bar when the entity is missing or unavailable', () => {
        for (const hass of [hassWith({}), hassWith({ 's.x': { state: 'unavailable', attributes: {} } })]) {
            const bar = computeProgressBar({ act: {}, target: 's.x', hass });
            expect(bar.available).toBe(false);
            expect(bar.pct).toBe(0);
            expect(bar.valueStr).toBe('--');
            expect(bar.color).toContain('rgba');
        }
    });

    it('formats the value with the entity unit and the requested decimals', () => {
        const hass = hassWith({ 'sensor.brush': { state: '298.7031', attributes: { unit_of_measurement: 'h' } } });
        expect(computeProgressBar({ act: {}, target: 'sensor.brush', hass }).valueStr).toBe('298.7 h');
        expect(computeProgressBar({ act: { decimals: 0 }, target: 'sensor.brush', hass }).valueStr).toBe('299 h');
        expect(computeProgressBar({ act: { unit: '' }, target: 'sensor.brush', hass }).valueStr).toBe('298.7');
    });

    it('colours low readings red and healthy ones green by default', () => {
        const mk = (state) => computeProgressBar({
            act: { max: 300 }, target: 's.x',
            hass: hassWith({ 's.x': { state, attributes: {} } })
        }).color;
        expect(mk('5')).toBe('#ef4444');    // ~2%
        expect(mk('45')).toBe('#f59e0b');   // 15%
        expect(mk('280')).toBe('#10b981');  // 93%
    });

    it('flips the healthy end when invert is set', () => {
        const mk = (state) => computeProgressBar({
            act: { invert: true }, target: 's.x',
            hass: hassWith({ 's.x': { state, attributes: {} } })
        }).color;
        expect(mk('5')).toBe('#10b981');
        expect(mk('95')).toBe('#ef4444');
    });

    it('lets an explicit colour and explicit thresholds win', () => {
        const hass = hassWith({ 's.x': { state: '5', attributes: {} } });
        expect(computeProgressBar({ act: { color: '#123456' }, target: 's.x', hass }).color).toBe('#123456');
        expect(computeProgressBar({
            act: { thresholds: [{ pct: 0, color: '#aaa' }, { pct: 50, color: '#bbb' }] },
            target: 's.x', hass
        }).color).toBe('#aaa');
    });

    it('falls back to the friendly name for the caption, and honours an empty name', () => {
        const hass = hassWith({ 's.x': { state: '1', attributes: { friendly_name: 'Main brush' } } });
        expect(computeProgressBar({ act: {}, target: 's.x', hass }).label).toBe('Main brush');
        expect(computeProgressBar({ act: { name: '' }, target: 's.x', hass }).label).toBe('');
        expect(computeProgressBar({ act: { name: 'Brush' }, target: 's.x', hass }).label).toBe('Brush');
    });

    it('survives being called with no hass at all', () => {
        const bar = computeProgressBar();
        expect(bar.available).toBe(false);
        expect(bar.pct).toBe(0);
    });
});

describe('pickColor', () => {
    it('takes the last matching threshold', () => {
        expect(pickColor(DEFAULT_THRESHOLDS, 100, null)).toBe('#10b981');
        expect(pickColor(DEFAULT_THRESHOLDS, 0, null)).toBe('#ef4444');
    });

    it('supports raw-value thresholds', () => {
        const t = [{ value: 0, color: 'red' }, { value: 100, color: 'green' }];
        expect(pickColor(t, 0, 5)).toBe('red');
        expect(pickColor(t, 0, 500)).toBe('green');
    });

    it('ignores malformed entries', () => {
        expect(pickColor([null, {}, { pct: 0 }], 50, 1)).toBe(null);
    });
});

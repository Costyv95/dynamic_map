import { describe, it, expect } from 'vitest';
import { computeSensorPill, estimateTextWidth } from '../shared/SensorPill.js';

const hassWith = (states) => ({ states });

describe('SensorPill flow layout', () => {
    const sc = {
        entity_id: 'sensor.room_temperature',
        config: { color: '#10b981', icon: '🌡️' }
    };

    it('never overlaps icon and value, even for long values', () => {
        for (const state of ['9', '21.4', '-12.5', '100', '2345.67']) {
            const p = computeSensorPill({
                sc,
                hass: hassWith({ 'sensor.room_temperature': { state } })
            });
            const iconRightEdge = p.iconX + (p.fontIcon * 1.1) / 2;
            expect(p.textX).toBeGreaterThanOrEqual(iconRightEdge);
            // value must fit inside the pill (estimate-based, with padding)
            const textEnd = p.textX + estimateTextWidth(p.value, p.fontValue);
            expect(textEnd).toBeLessThanOrEqual(p.width / 2 + 0.01);
        }
    });

    it('grows the pill with the value length', () => {
        const short = computeSensorPill({ sc, hass: hassWith({ 'sensor.room_temperature': { state: '9' } }) });
        const long = computeSensorPill({ sc, hass: hassWith({ 'sensor.room_temperature': { state: '-2345.6' } }) });
        expect(long.width).toBeGreaterThan(short.width);
    });

    it('resolves state overrides over config over defaults', () => {
        const p = computeSensorPill({
            sc,
            state: {
                color: '#3b82f6',
                icon: '❄️',
                display_entity: 'sensor.outdoor',
                unit: '°C'
            },
            hass: hassWith({ 'sensor.outdoor': { state: '3.5' } })
        });
        expect(p.color).toBe('#3b82f6');
        expect(p.icon).toBe('❄️');
        expect(p.value).toBe('3.5°C');
        expect(p.fg).toBe('#ffffff');
    });

    it('uses the accent color as foreground when transparent', () => {
        const p = computeSensorPill({
            sc: { ...sc, config: { ...sc.config, transparent: true } },
            hass: hassWith({ 'sensor.room_temperature': { state: '21' } })
        });
        expect(p.transparent).toBe(true);
        expect(p.fg).toBe('#10b981');
    });

    it('scales geometry with scaleX/scaleY', () => {
        const p = computeSensorPill({ sc, hass: null, scaleX: 2, scaleY: 3 });
        expect(p.height).toBe(72);   // 24 * 3
        expect(p.rx).toBe(16);       // 8 * min(2,3)
        expect(p.fontIcon).toBe(28); // 14 * min(2,3)
        expect(p.fontValue).toBe(24);
    });
});

describe('SensorPill display override (tap-to-cycle)', () => {
    const sc = {
        config: {
            temperature_entity: 'sensor.soil_temp',
            humidity_entity: 'sensor.soil_moisture',
            icon: '🍅'
        }
    };
    const hass = hassWithStates();

    function hassWithStates() {
        return {
            states: {
                'sensor.soil_temp': { state: '24.5' },
                'sensor.soil_moisture': { state: '58' }
            }
        };
    }

    it('shows the temperature entity by default', () => {
        const p = computeSensorPill({ sc, hass });
        expect(p.value).toBe('24.5°');
        expect(p.icon).toBe('🍅');
    });

    it('displayOverride switches entity, unit and icon', () => {
        const p = computeSensorPill({
            sc, hass,
            displayOverride: { entity: 'sensor.soil_moisture', unit: '%', icon: '💧' }
        });
        expect(p.value).toBe('58%');
        expect(p.icon).toBe('💧');
    });

    it('displayOverride beats a configured value_template', () => {
        const templated = { config: { ...sc.config, value_template: "{states('sensor.soil_temp')}°" } };
        const p = computeSensorPill({
            sc: templated, hass,
            displayOverride: { entity: 'sensor.soil_moisture', unit: '%' }
        });
        expect(p.value).toBe('58%');
    });
});

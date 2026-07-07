import { describe, it, expect } from 'vitest';
import { MapShortcut } from '../shortcuts/MapShortcut.js';

const svgNS = 'http://www.w3.org/2000/svg';

function makeShortcut(scData, hass) {
    const mapContext = { _hass: hass, imgW: 1000, imgH: 1000 };
    const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
    shortcut.render();
    shortcut.updateState(hass);
    return shortcut;
}

describe('unified badge depth styling', () => {
    it('solid shapes get a gloss overlay and drop shadow with per-shortcut defs', () => {
        const hass = { states: { 'switch.pump': { state: 'off', attributes: {} } } };
        const shortcut = makeShortcut({
            id: 'sc_pump-1',
            entity_id: 'switch.pump',
            type: 'switch',
            position: [50, 50],
            config: { shape: 'circle', color: '#0ea5e9', transparent: false }
        }, hass);

        expect(shortcut.shape.getAttribute('filter')).toBe('url(#dm_shadow_sc_pump-1)');
        const gloss = shortcut.bgGroup.querySelector('.dm-badge-gloss');
        expect(gloss).toBeTruthy();
        expect(gloss.getAttribute('fill')).toBe('url(#dm_gloss_sc_pump-1)');
        expect(shortcut.group.querySelector('defs radialGradient#dm_gloss_sc_pump-1')).toBeTruthy();
        expect(shortcut.group.querySelector('defs filter#dm_shadow_sc_pump-1 feDropShadow')).toBeTruthy();
    });

    it('transparent shapes are left untouched', () => {
        const hass = { states: { 'sensor.t': { state: '20', attributes: {} } } };
        const shortcut = makeShortcut({
            id: 'sc_trans',
            entity_id: 'sensor.t',
            type: 'switch',
            position: [50, 50],
            config: { shape: 'circle', color: '#0ea5e9', transparent: true }
        }, hass);

        expect(shortcut.bgGroup.querySelector('.dm-badge-gloss')).toBeNull();
        expect(shortcut.shape.getAttribute('filter')).toBeNull();
    });
});

describe('light-pool glow', () => {
    const lightData = (extraCfg = {}) => ({
        id: 'sc_glow',
        entity_id: 'light.lamp',
        type: 'light',
        position: [50, 50],
        config: { shape: 'circle', color: '#475569', transparent: false, ...extraCfg }
    });

    it('lights that are on cast two intertwined glow blobs in their live rgb_color', () => {
        const hass = { states: { 'light.lamp': { state: 'on', attributes: { rgb_color: [255, 29, 30] } } } };
        const shortcut = makeShortcut(lightData(), hass);

        expect(shortcut.glowGroup).toBeTruthy();
        expect(shortcut.glowGroup.style.display).toBe('block');
        expect(shortcut._glowVisible).toBe(true);
        expect(Number(shortcut.glowEl.getAttribute('r'))).toBe(75);
        expect(Number(shortcut.glowBlob2.getAttribute('r'))).toBe(50);
        expect(shortcut.glowEl.style.mixBlendMode).toBe('screen');
        const stop = shortcut.group.querySelector('#dm_glow_sc_glow stop');
        expect(stop.getAttribute('stop-color')).toBe('rgb(255, 29, 30)');
        // second blob is hue-shifted, not identical
        const stop2 = shortcut.group.querySelector('#dm_glow2_sc_glow stop');
        expect(stop2.getAttribute('stop-color')).not.toBe(stop.getAttribute('stop-color'));
    });

    it('hides the glow when the light turns off', () => {
        const hass = { states: { 'light.lamp': { state: 'on', attributes: { rgb_color: [1, 2, 3] } } } };
        const shortcut = makeShortcut(lightData(), hass);
        expect(shortcut._glowVisible).toBe(true);

        hass.states['light.lamp'] = { state: 'off', attributes: {} };
        shortcut.updateState(hass);
        expect(shortcut._glowVisible).toBe(false);
        expect(shortcut.glowGroup.style.display).toBe('none');
    });

    it('non-light shortcuts get no glow unless opted in with config.glow', () => {
        const hass = { states: { 'switch.pump': { state: 'on', attributes: {} } } };
        const off = makeShortcut({ ...lightData(), id: 'sc_ng', type: 'switch', entity_id: 'switch.pump' }, hass);
        expect(off._glowVisible).toBeFalsy();

        const on = makeShortcut({
            ...lightData({ glow: true }), id: 'sc_og', type: 'switch', entity_id: 'switch.pump'
        }, hass);
        expect(on._glowVisible).toBe(true);
    });

    it('animate() breathes the glow and drifts the blobs independently', () => {
        const hass = { states: { 'light.lamp': { state: 'on', attributes: { rgb_color: [10, 20, 30] } } } };
        const shortcut = makeShortcut(lightData(), hass);
        shortcut.animate(0.5);
        const first = Number(shortcut.glowGroup.getAttribute('opacity'));
        const t1 = shortcut.glowEl.getAttribute('transform');
        shortcut.animate(0.9);
        const second = Number(shortcut.glowGroup.getAttribute('opacity'));
        const t2 = shortcut.glowEl.getAttribute('transform');
        [first, second].forEach(v => {
            expect(v).toBeGreaterThan(0.6);
            expect(v).toBeLessThanOrEqual(1);
        });
        expect(first).not.toBe(second);
        expect(t1).not.toBe(t2);
        expect(shortcut.glowBlob2.getAttribute('transform')).not.toBe(t2);
    });
});

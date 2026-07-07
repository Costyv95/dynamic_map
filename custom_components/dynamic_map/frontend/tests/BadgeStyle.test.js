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
        // circle badge (r 12) + full-brightness range (1000 * 0.09): round pool
        expect(Number(shortcut.glowEl.getAttribute('rx'))).toBeCloseTo(102, 0);
        expect(shortcut.glowEl.getAttribute('rx')).toBe(shortcut.glowEl.getAttribute('ry'));
        expect(shortcut.glowEl.style.mixBlendMode).toBe('screen');
        const stop = shortcut.glowDefs.querySelector('#dm_glow_sc_glow stop');
        expect(stop.getAttribute('stop-color')).toBe('rgb(255, 29, 30)');
        // second blob is hue-shifted, not identical
        const stop2 = shortcut.glowDefs.querySelector('#dm_glow2_sc_glow stop');
        expect(stop2.getAttribute('stop-color')).not.toBe(stop.getAttribute('stop-color'));
    });

    it('brightness scales the pool range; glow_strength raises the max', () => {
        const dim = { states: { 'light.lamp': { state: 'on', attributes: { rgb_color: [255, 0, 0], brightness: 128 } } } };
        const dimSc = makeShortcut(lightData(), dim);
        const dimRx = Number(dimSc.glowEl.getAttribute('rx'));
        expect(dimRx).toBeLessThan(70);

        const strong = makeShortcut(lightData({ glow_strength: 2 }), dim);
        expect(Number(strong.glowEl.getAttribute('rx'))).toBeGreaterThan(dimRx * 1.5);
    });

    it('clips the pool to the containing room when map context is available', () => {
        const svg = document.createElementNS(svgNS, 'svg');
        const mapRoot = document.createElementNS(svgNS, 'g');
        svg.appendChild(mapRoot);
        const mapContext = {
            _hass: null,
            imgW: 1000,
            imgH: 1000,
            mapRoot,
            rooms: [{ id: 'room_a', polygon: [[40, 40], [60, 40], [60, 60], [40, 60]] }],
            isPointInPolygon: (pt, poly) =>
                pt[0] >= 40 && pt[0] <= 60 && pt[1] >= 40 && pt[1] <= 60,
        };
        const hass = { states: { 'light.lamp': { state: 'on', attributes: { rgb_color: [0, 0, 255] } } } };
        const shortcut = new MapShortcut(lightData(), svgNS, 1000, 1000, mapContext);
        mapRoot.appendChild(shortcut.render());
        shortcut.updateState(hass);

        expect(shortcut.glowGroup.parentNode).toBe(mapRoot);
        expect(shortcut.glowGroup.getAttribute('clip-path')).toBe('url(#dm_clip_sc_glow)');
        const clipPoly = shortcut.glowDefs.querySelector('#dm_clip_sc_glow polygon');
        expect(clipPoly.getAttribute('points')).toContain('400,400');
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
        const first = Number(shortcut.glowInner.getAttribute('opacity'));
        const t1 = shortcut.glowEl.getAttribute('transform');
        shortcut.animate(0.9);
        const second = Number(shortcut.glowInner.getAttribute('opacity'));
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

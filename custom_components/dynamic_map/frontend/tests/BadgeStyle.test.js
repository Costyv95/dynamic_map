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

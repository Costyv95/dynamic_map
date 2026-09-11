import { describe, it, expect } from 'vitest';
import { MapShortcut } from '../shortcuts/MapShortcut.js';

describe('one-artwork off look', () => {
    it('an image badge without state overrides dims (opacity, no raster filter) while off or standby', () => {
        const svgNS = 'http://www.w3.org/2000/svg';
        const mapContext = { isRotated: false, activeMode: 'horizontal', imgW: 1000, imgH: 1000, svg: document.createElementNS(svgNS, 'svg') };
        const sc = { id: 'tv', entity_id: 'media_player.tv', type: 'media_player', position: [50, 50], config: { shape: 'rect', image: '/local/tv.svg', states: [], actions: [] } };
        const badge = new MapShortcut(sc, svgNS, 1000, 1000, mapContext);
        const hass = (state) => ({ states: { 'media_player.tv': { state, attributes: {} } } });
        badge.updateState(hass('standby'));
        expect(badge.iconImage).toBeTruthy();
        expect(badge.contentGroup.style.opacity).toBe('0.45');
        expect(badge.contentGroup.style.filter).toBe('');
        expect(badge.unavailableLine.style.display).toBe('none');
        badge.updateState(hass('on'));
        expect(badge.contentGroup.style.opacity).toBe('');
        badge.updateState(hass('unavailable'));
        expect(badge.unavailableLine.style.display).toBe('block');
    });
});

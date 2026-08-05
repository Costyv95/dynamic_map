// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { renderIcon } from '../shortcuts/components/renderIcon.js';
import { MapShortcut } from '../shortcuts/MapShortcut.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('renderIcon', () => {
    it('renders literal Unicode icons as visible SVG text in the map card', () => {
        const shortcut = new MapShortcut({
            id: 'sc_tv',
            entity_id: 'media_player.tv',
            position: [50, 50],
            config: { shape: 'rect', transparent: true, icon: '📺' }
        }, SVG_NS, 1000, 1000, { _hass: {} });
        shortcut.updateState({ states: { 'media_player.tv': { state: 'off' } } });

        const icon = shortcut.contentGroup.querySelector('text');
        expect(icon?.textContent).toBe('📺');
        expect(icon?.getAttribute('font-size')).toBe('18');
    });

    it('keeps MDI icons in a Home Assistant ha-icon foreignObject', () => {
        const icon = renderIcon(SVG_NS, { value: 'mdi:television' });

        expect(icon.localName).toBe('foreignObject');
        expect(icon.querySelector('ha-icon')?.getAttribute('icon')).toBe('mdi:television');
    });
});

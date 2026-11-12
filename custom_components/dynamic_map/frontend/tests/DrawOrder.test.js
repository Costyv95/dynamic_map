import { describe, it, expect } from 'vitest';
import { buildShortcuts, drawOrder } from '../core/MapScene.js';

const svgNS = 'http://www.w3.org/2000/svg';
const obj = (id, scale, extra = {}) => ({
    id, type: 'light', entity_id: `light.${id}`, position: [50, 50], scaleX: scale, scaleY: scale,
    config: { shape: 'rect', color: '#475569', transparent: true, ...extra }
});

describe('shortcut draw order', () => {
    it('draws larger objects first so a big light area never covers a small badge', () => {
        const strip = obj('strip', { horizontal: 9, vertical: 9 });   // orientation-keyed scale
        const lamp = obj('lamp', 1);
        const sofa = obj('sofa', 4, { decor: true });
        const plant = obj('plant', 1, { decor: true });
        const mapRoot = document.createElementNS(svgNS, 'g');
        const host = { svgNS, imgW: 1000, imgH: 1000, mapRoot, _hass: null, shortcuts: [lamp, plant, strip, sofa] };
        buildShortcuts(host);
        const order = (parent) => [...parent.children].map(g => Object.keys(host.shortcutElements)
            .find(id => host.shortcutElements[id].group === g)).filter(Boolean);
        expect(order(mapRoot)).toEqual(['strip', 'lamp']);          // the strip under the lamp
        expect(order(host.decorLayer)).toEqual(['sofa', 'plant']);  // decor: same rule, in its own layer
        const kids = [...mapRoot.children];
        expect(kids.indexOf(host.decorLayer)).toBeLessThan(kids.indexOf(host.shortcutElements.strip.group));
    });

    it('keeps the saved order between objects of the same size', () => {
        const a = obj('a', 2), b = obj('b', 2), c = obj('c', 2);
        expect(drawOrder([b, c, a]).map(s => s.id)).toEqual(['b', 'c', 'a']);
    });
});

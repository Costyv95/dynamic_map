import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../custom-svg-map.js';
import { MapShortcut } from '../shortcuts/MapShortcut.js';

const svgNS = 'http://www.w3.org/2000/svg';

function makeCard(config = {}) {
    const card = document.createElement('custom-svg-map');
    card.config = { ...config };
    card.imgW = 1000;
    card.imgH = 1000;
    card.mapRoot = document.createElementNS(svgNS, 'g');
    card.rooms = [
        { id: 'r1', name: 'Office', polygon: [[10, 10], [30, 10], [30, 30], [10, 30]] },
        { id: 'r2', name: 'Bedroom', area_id: 'bedroom_area', polygon: [[50, 50], [90, 50], [90, 90], [50, 90]] },
    ];
    return card;
}

function makeShortcut(scData, hass) {
    const mapContext = { _hass: hass, imgW: 1000, imgH: 1000 };
    const shortcut = new MapShortcut(scData, svgNS, 1000, 1000, mapContext);
    shortcut.render();
    shortcut.updateState(hass);
    return shortcut;
}

describe('ambient day/night tint', () => {
    beforeEach(() => {
        global.requestAnimationFrame = vi.fn();
        global.cancelAnimationFrame = vi.fn();
    });
    afterEach(() => vi.restoreAllMocks());

    const hassAt = (elevation) => ({ states: { 'sun.sun': { state: 'x', attributes: { elevation } } } });

    it('is clear during the day', () => {
        const card = makeCard();
        card.buildAmbientTint();
        card.updateAmbientTint(hassAt(30));
        expect(Number(card.ambientTint.getAttribute('opacity'))).toBe(0);
    });

    it('warms up through golden hour', () => {
        const card = makeCard();
        card.buildAmbientTint();
        card.updateAmbientTint(hassAt(3));
        expect(card.ambientTint.getAttribute('fill')).toBe('rgb(255, 158, 87)');
        expect(Number(card.ambientTint.getAttribute('opacity'))).toBeCloseTo(0.09, 2);
        expect(card.ambientTint.style.mixBlendMode).toBe('multiply');
    });

    it('cools toward a night tone after dusk and settles at full night', () => {
        const card = makeCard();
        card.buildAmbientTint();
        card.updateAmbientTint(hassAt(-7));
        expect(card.ambientTint.getAttribute('fill')).toBe('rgb(175, 137, 124)');
        expect(Number(card.ambientTint.getAttribute('opacity'))).toBeCloseTo(0.24, 2);
        card.updateAmbientTint(hassAt(-30));
        expect(card.ambientTint.getAttribute('fill')).toBe('rgb(95, 116, 160)');
        expect(Number(card.ambientTint.getAttribute('opacity'))).toBeCloseTo(0.3, 2);
    });

    it('can be disabled and survives a missing sun entity', () => {
        const off = makeCard({ ambient_tint: false });
        off.buildAmbientTint();
        expect(off.ambientTint).toBeNull();

        const card = makeCard();
        card.buildAmbientTint();
        card.updateAmbientTint({ states: {} });
        expect(Number(card.ambientTint.getAttribute('opacity'))).toBe(0);
    });

    it('covers the full canvas in image mode', () => {
        const card = makeCard();
        card.floorBgMode = 'image';
        card.buildAmbientTint();
        expect(card.ambientTint.tagName.toLowerCase()).toBe('rect');
        expect(card.ambientTint.getAttribute('width')).toBe('1000');
    });

    it('hugs the room plate in fit mode instead of overflowing the canvas', () => {
        const card = makeCard();
        card.floorBgMode = 'fit';
        card.buildAmbientTint();
        // a group of per-room polygons, not a full-canvas rect
        expect(card.ambientTint.tagName.toLowerCase()).toBe('g');
        const polys = card.ambientTint.querySelectorAll('polygon');
        expect(polys.length).toBe(card.rooms.length);
        // tint color drives both fill and stroke (the plate fattening)
        card.updateAmbientTint(hassAt(-30));
        expect(card.ambientTint.getAttribute('fill')).toBe('rgb(95, 116, 160)');
        expect(card.ambientTint.getAttribute('stroke')).toBe('rgb(95, 116, 160)');
    });
});

describe('presence dots', () => {
    beforeEach(() => {
        global.requestAnimationFrame = vi.fn();
        global.cancelAnimationFrame = vi.fn();
    });
    afterEach(() => vi.restoreAllMocks());

    const presenceCard = (items) => {
        const card = makeCard({ presence: items });
        card.buildPresenceLayer();
        return card;
    };

    it('places a dot at the center of the room named by the entity state', () => {
        const card = presenceCard([{ entity: 'sensor.costi_area', name: 'Costi', color: '#123456' }]);
        card.updatePresence({ states: { 'sensor.costi_area': { state: 'Office' } } });
        const dot = card._presenceDots[0];
        expect(dot.visible).toBe(true);
        expect(dot.tx).toBeCloseTo(200);
        expect(dot.ty).toBeCloseTo(200);
        expect(dot.el.getAttribute('transform')).toBe('translate(200.0, 200.0)');
        expect(dot.el.querySelector('circle').getAttribute('fill')).toBe('#123456');
        expect(dot.el.querySelector('text').textContent).toBe('C');
    });

    it('matches rooms by area id and by HA area name', () => {
        const card = presenceCard([{ entity: 'sensor.p' }]);
        card.updatePresence({ states: { 'sensor.p': { state: 'bedroom_area' } } });
        expect(card._presenceDots[0].tx).toBeCloseTo(700);

        card.updatePresence({
            states: { 'sensor.p': { state: 'Sleep Room' } },
            areas: { bedroom_area: { name: 'Sleep Room' } },
        });
        expect(card._presenceDots[0].tx).toBeCloseTo(700);
    });

    it('glides toward a new room instead of jumping', () => {
        const card = presenceCard([{ entity: 'sensor.p' }]);
        card.updatePresence({ states: { 'sensor.p': { state: 'Office' } } });
        card.updatePresence({ states: { 'sensor.p': { state: 'Bedroom' } } });
        const dot = card._presenceDots[0];
        expect(dot.curX).toBeCloseTo(200);
        card.shortcutElements = {};
        card.lastTime = 0;
        card.animate(100); // dt = 0.1s
        expect(dot.curX).toBeGreaterThan(200);
        expect(dot.curX).toBeLessThan(700);
    });

    it('hides dots that are away or in an unknown room', () => {
        const card = presenceCard([{ entity: 'sensor.p' }]);
        card.updatePresence({ states: { 'sensor.p': { state: 'Office' } } });
        card.updatePresence({ states: { 'sensor.p': { state: 'not_home' } } });
        expect(card._presenceDots[0].visible).toBe(false);
        expect(card._presenceDots[0].el.style.display).toBe('none');
        card.updatePresence({ states: { 'sensor.p': { state: 'Garage' } } });
        expect(card._presenceDots[0].visible).toBe(false);
    });

    it('spreads multiple people sharing one room apart', () => {
        const card = presenceCard([{ entity: 'sensor.a' }, { entity: 'sensor.b' }]);
        card.updatePresence({ states: {
            'sensor.a': { state: 'Office' },
            'sensor.b': { state: 'Office' },
        } });
        const [a, b] = card._presenceDots;
        expect(a.visible && b.visible).toBe(true);
        expect(Math.hypot(a.tx - b.tx, a.ty - b.ty)).toBeGreaterThan(10);
    });
});

describe('media equalizer', () => {
    const tvData = { id: 'sc_tv', entity_id: 'media_player.tv', type: 'media', position: [50, 50], config: { shape: 'rect', color: '#334155', transparent: false } };

    it('shows animated bars while playing', () => {
        const hass = { states: { 'media_player.tv': { state: 'playing', attributes: {} } } };
        const sc = makeShortcut(tvData, hass);
        expect(sc._eqVisible).toBe(true);
        expect(sc.eqBars).toHaveLength(3);
        expect(sc.eqGroup.style.display).toBe('block');
        sc.animate(0.4);
        const first = sc.eqBars.map(b => b.getAttribute('height'));
        sc.animate(0.4);
        const second = sc.eqBars.map(b => b.getAttribute('height'));
        expect(first).not.toEqual(second);
        expect(new Set(first).size).toBeGreaterThan(1); // bars are out of phase
    });

    it('hides when paused', () => {
        const hass = { states: { 'media_player.tv': { state: 'playing', attributes: {} } } };
        const sc = makeShortcut(tvData, hass);
        hass.states['media_player.tv'] = { state: 'paused', attributes: {} };
        sc.updateState(hass);
        expect(sc._eqVisible).toBe(false);
        expect(sc.eqGroup.style.display).toBe('none');
    });
});

describe('tiled image textures', () => {
    const stripData = (tiling) => ({
        id: 'sc_strip',
        entity_id: 'light.strip',
        type: 'light',
        position: [50, 50],
        scaleX: 4,
        scaleY: 1,
        config: { shape: 'rect', color: '#334155', transparent: true, proportional: false, image: '/dynamic_map_data/icons/obj_led_strip_tile.svg', image_tiling: tiling }
    });
    const hass = { states: { 'light.strip': { state: 'off', attributes: {} } } };

    it('repeats the image as square tiles across the rect', () => {
        const sc = makeShortcut(stripData(true), hass);
        const rect = sc.contentGroup.querySelector('rect#fallback_image');
        expect(rect).toBeTruthy();
        expect(rect.getAttribute('fill')).toBe('url(#dm_tile_sc_strip)');
        // 24*4 wide, 24 tall -> four 24x24 tiles
        expect(rect.getAttribute('width')).toBe('96');
        expect(rect.getAttribute('height')).toBe('24');
        const pattern = sc.group.querySelector('defs pattern#dm_tile_sc_strip');
        expect(pattern.getAttribute('width')).toBe('24');
        expect(pattern.getAttribute('height')).toBe('24');
        expect(pattern.querySelector('image').getAttribute('href')).toBe('/dynamic_map_data/icons/obj_led_strip_tile.svg');
        expect(sc.iconImage).toBe(rect);
    });

    it('keeps the classic stretched image without the flag', () => {
        const sc = makeShortcut(stripData(false), hass);
        expect(sc.contentGroup.querySelector('rect#fallback_image')).toBeNull();
        expect(sc.iconImage && sc.iconImage.tagName).toBe('image');
    });

    it('rotates the tiles along a vertical strip', () => {
        const data = { ...stripData(true), scaleX: 1, scaleY: 4 };
        const sc = makeShortcut(data, hass);
        const rect = sc.contentGroup.querySelector('rect#fallback_image');
        expect(rect.getAttribute('width')).toBe('24');
        expect(rect.getAttribute('height')).toBe('96');
        const pattern = sc.group.querySelector('defs pattern#dm_tile_sc_strip');
        // tile stays square on the SHORT side; artwork turns to run down the strip
        expect(pattern.getAttribute('width')).toBe('24');
        expect(pattern.getAttribute('height')).toBe('24');
        expect(pattern.querySelector('g').getAttribute('transform')).toBe('rotate(90 12 12)');
    });

    it("tiles a panel in both directions with 'both' + tile_size", () => {
        const data = {
            ...stripData('both'), scaleX: 4, scaleY: 4,
            config: { ...stripData('both').config, image_tiling: 'both', image_tile_size: 12 }
        };
        const sc = makeShortcut(data, hass);
        const rect = sc.contentGroup.querySelector('rect#fallback_image');
        expect(rect.getAttribute('width')).toBe('96');
        expect(rect.getAttribute('height')).toBe('96');
        const pattern = sc.group.querySelector('defs pattern#dm_tile_sc_strip');
        // 8x8 grid of 12px tiles, never rotated in 2D mode
        expect(pattern.getAttribute('width')).toBe('12');
        expect(pattern.getAttribute('height')).toBe('12');
        expect(pattern.querySelector('g').getAttribute('transform')).toBeNull();
    });
});

describe('vacuum dust puffs', () => {
    const vacData = { id: 'sc_vac', entity_id: 'vacuum.robo', type: 'vacuum', position: [50, 50], config: { shape: 'circle', color: '#334155', transparent: false } };

    it('trails fading puffs while cleaning', () => {
        const hass = { states: { 'vacuum.robo': { state: 'cleaning', attributes: {} } } };
        const sc = makeShortcut(vacData, hass);
        expect(sc._dustActive).toBe(true);
        expect(sc.dustPuffs).toHaveLength(3);
        sc.animate(0.3);
        const puff = sc.dustPuffs[0];
        expect(Number(puff.getAttribute('cx'))).toBeLessThan(0); // trails behind
        expect(Number(puff.getAttribute('opacity'))).toBeGreaterThan(0);
        expect(Number(puff.getAttribute('opacity'))).toBeLessThanOrEqual(0.45);
    });

    it('stops when docked', () => {
        const hass = { states: { 'vacuum.robo': { state: 'cleaning', attributes: {} } } };
        const sc = makeShortcut(vacData, hass);
        hass.states['vacuum.robo'] = { state: 'docked', attributes: {} };
        sc.updateState(hass);
        expect(sc._dustActive).toBe(false);
        expect(sc.dustGroup.style.display).toBe('none');
    });
});

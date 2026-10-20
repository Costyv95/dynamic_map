import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { drawFurniture, furnitureKinds, FURNITURE_COLORS } from '../shared/Furniture.js';
import { floorCanvas, floorBackgroundMode, platePad } from '../shared/FloorPlan.js';
import { MapShortcut } from '../shortcuts/MapShortcut.js';
import { forgetFloors } from '../card/FloorData.js';
import '../custom-svg-map.js';

const svgNS = 'http://www.w3.org/2000/svg';
const NUMERIC = ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'stroke-width'];

describe('parametric furniture', () => {
    it('every kind draws real, finite geometry at its usual size and at odd sizes', () => {
        for (const { value, size } of furnitureKinds()) {
            for (const [w, h] of [size, [size[0] * 3, size[1] * 0.5], [12, 300]]) {
                const g = drawFurniture(svgNS, { kind: value, width: w, height: h });
                expect(g.childNodes.length, value).toBeGreaterThan(0);
                g.querySelectorAll('*').forEach(el => NUMERIC.forEach(a => {
                    if (el.hasAttribute(a)) expect(Number.isFinite(Number(el.getAttribute(a))), `${value} ${a}`).toBe(true);
                }));
                g.querySelectorAll('path').forEach(p => expect(p.getAttribute('d')).not.toMatch(/NaN|Infinity/));
            }
        }
    });

    it('a mirrored door moves its hinge; an unknown kind is a visible dashed box', () => {
        expect(drawFurniture(svgNS, { kind: 'door', width: 90, height: 90, opts: { mirror: true } }).getAttribute('transform')).toBe('scale(-1 1)');
        const odd = drawFurniture(svgNS, { kind: 'no_such_thing', width: 40, height: 20 });
        expect(odd.querySelector('rect').getAttribute('stroke-dasharray')).toBe('4 3');
    });

    it('a planter lines its plants up along its long side, however it is sized', () => {
        const plants = (w, h) => [...drawFurniture(svgNS, { kind: 'planter', width: w, height: h, opts: { plants: 3 } }).querySelectorAll('circle')];
        const xs = plants(150, 50).map(c => Number(c.getAttribute('cx')));
        const ys = plants(50, 150).map(c => Number(c.getAttribute('cy')));
        expect(xs).toHaveLength(3);
        expect(new Set(xs).size).toBe(3);
        expect(new Set(ys).size).toBe(3);
    });

    it('a door with cut paints the wall under its opening in the floor colour', () => {
        const g = drawFurniture(svgNS, { kind: 'door', width: 90, height: 90, colors: { ...FURNITURE_COLORS, floor: '#123456' }, opts: { cut: 18 } });
        expect([...g.querySelectorAll('rect')].some(r => r.getAttribute('fill') === '#123456')).toBe(true);
    });

    it('a decor shortcut with config.furniture draws that kind at its frame size, through the real badge', () => {
        const sc = new MapShortcut({
            id: 'fur_sofa', type: 'generic', position: [50, 50], scaleX: 10, scaleY: 4,
            config: { shape: 'rect', transparent: true, decor: true, autoRotate: true, proportional: false, furniture: 'sofa' }
        }, svgNS, 1000, 1000, { _hass: null, imgW: 1000, imgH: 1000 });
        sc.render();
        sc.updateState(null);
        const g = sc.group.querySelector('g.dm-furniture');
        expect(g && g.dataset.kind).toBe('sofa');
        const outline = g.querySelector('rect');
        expect(Number(outline.getAttribute('width'))).toBe(240);
        expect(Number(outline.getAttribute('height'))).toBe(96);
    });

    it('furniture greys follow the host floor tone', () => {
        const tone = { paper: [18, 24, 38], ink: [133, 144, 166] };
        const sc = new MapShortcut({
            id: 'fur_bed', type: 'generic', position: [50, 50], scaleX: 6, scaleY: 8,
            config: { shape: 'rect', transparent: true, decor: true, proportional: false, furniture: 'bed' }
        }, svgNS, 1000, 1000, { _hass: null, imgW: 1000, imgH: 1000, floorTone: tone });
        sc.render();
        sc.updateState(null);
        expect(sc.group.querySelector('g.dm-furniture rect').getAttribute('fill')).toBe('#121826');
    });
});

describe('floor canvas', () => {
    it('reads a canvas and treats it as a drawn floor', () => {
        expect(floorCanvas({ canvas: { w: 1280, h: 1920 } })).toEqual({ w: 1280, h: 1920 });
        expect(floorCanvas({ canvas: { w: 0, h: 10 } })).toBeNull();
        expect(floorCanvas(null)).toBeNull();
        expect(floorBackgroundMode({ canvas: { w: 10, h: 10 }, background_mode: 'image' })).toBe('fit');
        expect(floorBackgroundMode({})).toBe('image');
        expect(floorBackgroundMode({ background_mode: 'fit' })).toBe('fit');
    });

    it('the plate reaches half the thickest wall, or a soft pad without walls', () => {
        expect(platePad([{ thickness: 18 }, { thickness: 36 }], 1280, 1920)).toBe(18);
        expect(platePad([], 1000, 2000)).toBe(70);
    });
});

describe('card on a drawn floor', () => {
    const files = {
        rooms_floor1: [{ id: 'r1', name: 'Hall', polygon: [[10, 10], [60, 10], [60, 60], [10, 60]] }],
        shortcuts_floor1: [{ id: 'fur_1', type: 'generic', position: [30, 30], scaleX: 4, scaleY: 2,
            config: { shape: 'rect', transparent: true, decor: true, proportional: false, furniture: 'table' } }],
        config_floor1: { canvas: { w: 800, h: 600 }, background_color: '#eeeeee',
            walls: [{ id: 'w1', points: [[10, 10], [60, 10]], thickness: 20, color: '#1e293b' }] }
    };

    beforeEach(() => {
        forgetFloors();
        global.requestAnimationFrame = vi.fn();
        global.cancelAnimationFrame = vi.fn();
        global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        global.fetch = vi.fn(async (url) => {
            const key = Object.keys(files).find(k => String(url).includes(`/${k}.json`));
            return key ? { ok: true, json: async () => files[key] } : { ok: false };
        });
    });
    afterEach(() => { vi.restoreAllMocks(); forgetFloors(); });

    it('builds walls, plate and furniture from data and never asks for a floor picture', async () => {
        const card = document.createElement('custom-svg-map');
        document.body.appendChild(card);
        card.setConfig({ floors: [1] });
        card.hass = { states: {}, callService: vi.fn(), callApi: vi.fn().mockResolvedValue({ floors: [1] }) };
        await vi.waitFor(() => expect(card.shadowRoot.querySelector('.dm-walls path')).toBeTruthy());
        const root = card.shadowRoot;
        expect(card.imgW).toBe(800);
        expect(card.imgH).toBe(600);
        expect(root.querySelector('.dm-room-plate')).toBeTruthy();
        expect(root.querySelector('image.dm-bg-image')).toBeNull();
        expect(root.querySelector('g.dm-furniture[data-kind="table"]')).toBeTruthy();
        expect(global.fetch.mock.calls.some(c => String(c[0]).includes('bg_floor'))).toBe(false);
        card.remove();
    });
});

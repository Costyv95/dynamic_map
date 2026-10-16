import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseColor, toneColor, tonePixels, readFloorTone, tonedDecor } from '../card/FloorTone.js?v=3.2.1';
import { loadData, forgetFloors } from '../card/FloorData.js?v=3.2.1';
import { buildBackground, buildWalls } from '../core/MapScene.js?v=3.2.1';
import { CARD_STYLES } from '../card/CardStyles.js?v=3.2.1';

const TONE = { paper: [12, 17, 27], ink: [125, 135, 154] };

describe('floor tone colours', () => {
    it('parses hex and rgb()', () => {
        expect(parseColor('#fff')).toEqual([255, 255, 255]);
        expect(parseColor(' #0c111b ')).toEqual([12, 17, 27]);
        expect(parseColor('rgb(1 2 3)')).toEqual([1, 2, 3]);
        expect(parseColor('rgba(4, 5, 6, .5)')).toEqual([4, 5, 6]);
        expect(parseColor('')).toBeNull();
        expect(parseColor('var(--x)')).toBeNull();
    });

    it('white becomes paper, black becomes ink, a grey blends', () => {
        expect(toneColor(TONE, '#ffffff')).toBe('#0c111b');
        expect(toneColor(TONE, '#000000')).toBe('#7d879a');
        const mid = parseColor(toneColor(TONE, '#808080'));
        mid.forEach((v, i) => {
            expect(v).toBeGreaterThan(Math.min(TONE.paper[i], TONE.ink[i]));
            expect(v).toBeLessThan(Math.max(TONE.paper[i], TONE.ink[i]));
        });
    });

    it('tones the near-black navy default wall but keeps a coloured wall', () => {
        expect(toneColor(TONE, '#0f172a')).not.toBe('#0f172a');
        expect(toneColor(TONE, '#8973dd')).toBe('#8973dd');
    });

    it('passes everything through without a tone', () => {
        expect(toneColor(null, '#ffffff')).toBe('#ffffff');
        expect(toneColor(TONE, null)).toBeNull();
    });

    it('recolours grey pixels and leaves colour and alpha alone', () => {
        const px = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 128, 200, 30, 30, 255]);
        tonePixels(TONE, px);
        expect([...px.slice(0, 4)]).toEqual([12, 17, 27, 255]);
        expect([...px.slice(4, 8)]).toEqual([125, 135, 154, 128]);
        expect([...px.slice(8, 12)]).toEqual([200, 30, 30, 255]);
    });

    it('reads the tone from the host only when both tokens are set', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        expect(readFloorTone(el)).toBeNull();
        el.style.setProperty('--dm-floor-paper', '#0c111b');
        expect(readFloorTone(el)).toBeNull();
        el.style.setProperty('--dm-floor-ink', '#7d879a');
        expect(readFloorTone(el)).toEqual(TONE);
        el.remove();
    });
});

describe('toned scene', () => {
    function host(extra) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        return { svgNS: 'http://www.w3.org/2000/svg', mapRoot: svg, imgW: 100, imgH: 100, rooms: [{ id: 'r', polygon: [[0, 0], [10, 0], [10, 10]] }], ...extra };
    }

    it('marks a toned picture, underlay and plate so the floor filter skips them', () => {
        const h = host({ floorBgColor: '#ffffff', floorTone: TONE, floorToned: true });
        buildBackground(h, 'blob:x');
        expect(h.mapRoot.querySelector('.dm-bg-underlay').getAttribute('fill')).toBe('#0c111b');
        expect(h.mapRoot.querySelector('.dm-bg-underlay').classList.contains('dm-toned')).toBe(true);
        expect(h.mapRoot.querySelector('.dm-bg-image').classList.contains('dm-toned')).toBe(true);
        const fit = host({ floorBgColor: '#ffffff', floorBgMode: 'fit', floorTone: TONE });
        buildBackground(fit, 'x');
        const plate = fit.mapRoot.querySelector('.dm-room-plate');
        expect(plate.classList.contains('dm-toned')).toBe(true);
        expect(plate.querySelector('polygon').getAttribute('fill')).toBe('#0c111b');
        expect(CARD_STYLES).toMatch(/\.dm-bg-image\.dm-toned[^{]*\{\s*filter:\s*none/);
    });

    it('a picture the tone could not render keeps the filter', () => {
        const h = host({ floorTone: TONE, floorToned: false });
        buildBackground(h, 'x.png');
        expect(h.mapRoot.querySelector('.dm-bg-image').classList.contains('dm-toned')).toBe(false);
    });

    it('draws grey walls in the tone', () => {
        const h = host({ floorTone: TONE, walls: [{ points: [[0, 0], [5, 5]] }, { points: [[0, 0], [5, 5]], color: '#8973dd' }] });
        buildWalls(h);
        const paths = h.mapRoot.querySelectorAll('.dm-walls path');
        expect(paths[0].getAttribute('stroke')).not.toBe('#0f172a');
        expect(paths[1].getAttribute('stroke')).toBe('#8973dd');
    });
});

describe('kept floors', () => {
    const RealImage = global.Image;
    let files;
    beforeEach(() => {
        forgetFloors();
        files = { rooms: [{ id: 'a' }] };
        global.Image = class { set src(v) { this.naturalWidth = 10; this.naturalHeight = 20; setTimeout(() => this.onload && this.onload()); } };
        global.fetch = vi.fn(async (url) => {
            const name = String(url).split('/').pop().split('_floor')[0].split('.')[0];
            const body = name === 'rooms' ? files.rooms : null;
            return body ? { ok: true, json: async () => body } : { ok: false };
        });
    });
    afterEach(() => { global.Image = RealImage; });

    function card() {
        return { activeFloor: 1, _loadSeq: 0, buildSVG: vi.fn(), renderRoot: document.createElement('div') };
    }
    const settle = () => new Promise(r => setTimeout(r, 5));

    it('a second visit shows the kept floor before the files are re-read', async () => {
        const first = card();
        await loadData(first); await settle();
        expect(first.buildSVG).toHaveBeenCalledTimes(1);
        const url = first.buildSVG.mock.calls[0][0];

        const again = card();
        const waiting = [];
        global.fetch = vi.fn(() => new Promise(r => waiting.push(r)));
        const pending = loadData(again);
        await settle();
        expect(again.buildSVG).toHaveBeenCalledTimes(1);           // built from the kept copy
        expect(again.buildSVG.mock.calls[0][0]).toBe(url);         // same picture URL, so it is cached
        expect(again.rooms).toEqual([{ id: 'a' }]);
        waiting.forEach(r => r({ ok: false }));
        await pending;
    });

    it('rebuilds only when the re-read files changed', async () => {
        const c = card();
        await loadData(c); await settle();
        await loadData(c); await settle();
        expect(c.buildSVG).toHaveBeenCalledTimes(2);               // kept show only, no rebuild
        const before = c.buildSVG.mock.calls[1][0];

        files.rooms = [{ id: 'b' }];
        await loadData(c); await settle();
        expect(c.buildSVG).toHaveBeenCalledTimes(4);               // kept show, then the new files
        expect(c.rooms).toEqual([{ id: 'b' }]);
        expect(c.buildSVG.mock.calls[3][0]).not.toBe(before);      // a changed floor gets a fresh picture URL
    });
});

describe('toned decor', () => {
    const RealFetch = global.fetch;
    afterEach(() => { global.fetch = RealFetch; });

    it('rewrites the greys of decor SVGs and skips devices and templates', async () => {
        const seen = [];
        global.fetch = vi.fn(async (url) => { seen.push(url); return { ok: true, text: async () => '<svg><rect fill="#ffffff" stroke="#0f172a"/><circle fill="#8973dd"/></svg>' }; });
        const blobs = [];
        const realCreate = URL.createObjectURL;
        URL.createObjectURL = (b) => { blobs.push(b); return `blob:${blobs.length}`; };
        try {
            const tones = await tonedDecor([
                { config: { decor: true, image: '/dynamic_map_data/icons/couch.svg' } },
                { config: { decor: true, image: '/dynamic_map_data/icons/{{ x }}.svg' } },
                { config: { image: '/dynamic_map_data/icons/lamp.svg' } }
            ], TONE, u => u.replace('/dynamic_map_data', '/base'));
            expect(seen).toEqual(['/base/icons/couch.svg']);
            expect(tones).toEqual({ '/base/icons/couch.svg': 'blob:1' });
            const text = await blobs[0].text();
            expect(text).toContain('fill="#0c111b"');
            expect(text).toContain('#8973dd');
            expect(text).not.toContain('#0f172a');
        } finally { URL.createObjectURL = realCreate; }
    });

    it('no tone, no copies', async () => {
        expect(await tonedDecor([{ config: { decor: true, image: 'a.svg' } }], null, u => u)).toBeNull();
    });
});

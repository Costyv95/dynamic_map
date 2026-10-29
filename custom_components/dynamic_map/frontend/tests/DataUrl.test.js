import { describe, it, expect, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { setDataBase, getDataBase, dataUrl, resolveDataUrl, DEFAULT_DATA_BASE, setDataFetch, dataFetch, dataImageUrl, setDataHref } from '../shared/DataUrl.js?v=3.2.1';
import { renderImage } from '../shortcuts/components/renderImage.js';

const ROOT = join(__dirname, '..');

function jsFiles(dir) {
    return readdirSync(dir).flatMap((name) => {
        if (name === 'node_modules' || name === 'tests') return [];
        const p = join(dir, name);
        if (statSync(p).isDirectory()) return jsFiles(p);
        return name.endsWith('.js') && !name.endsWith('.min.js') ? [p] : [];
    });
}

describe('DataUrl', () => {
    afterEach(() => setDataBase(undefined));

    it('defaults to the HA static path', () => {
        expect(getDataBase()).toBe('/dynamic_map_data');
        expect(dataUrl('rooms_floor1.json')).toBe('/dynamic_map_data/rooms_floor1.json');
    });

    it('takes a host base, dropping trailing slashes', () => {
        setDataBase('/api/files/ha/dynamic_map_data/');
        expect(dataUrl('bg_floor2.png?t=1')).toBe('/api/files/ha/dynamic_map_data/bg_floor2.png?t=1');
        setDataBase('');
        expect(getDataBase()).toBe(DEFAULT_DATA_BASE);
    });

    it('rebases stored data-dir URLs and leaves others alone', () => {
        setDataBase('https://portal.lan/files');
        expect(resolveDataUrl('/dynamic_map_data/icons/dock.svg')).toBe('https://portal.lan/files/icons/dock.svg');
        expect(resolveDataUrl('/local/x.svg')).toBe('/local/x.svg');
        expect(resolveDataUrl('')).toBe('');
    });

    it('shortcut images render through the base', () => {
        setDataBase('/p');
        const img = renderImage('http://www.w3.org/2000/svg', { value: '/dynamic_map_data/icons/a.svg' });
        expect(img.getAttribute('href')).toBe('/p/icons/a.svg');
    });

    it('no data-dir URL literal exists outside DataUrl.js', () => {
        const offenders = jsFiles(ROOT)
            .filter((f) => !f.endsWith(join('shared', 'DataUrl.js')))
            .filter((f) => /[`'"]\/dynamic_map_data\b/.test(readFileSync(f, 'utf8')))
            .map((f) => relative(ROOT, f));
        expect(offenders).toEqual([]);
    });
});

describe('DataUrl session reads (#1646)', () => {
    const SVG = 'http://www.w3.org/2000/svg';
    const ok = () => ({ ok: true, json: async () => [], blob: async () => new Blob(['x']) });
    const restore = () => { setDataBase(undefined); setDataFetch((u, i) => globalThis.fetch(u, i)); };
    afterEach(restore);

    it('reads HA data files with the session and anything else with plain fetch', async () => {
        const session = vi.fn(async () => ok());
        const plain = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok());
        setDataFetch(session);
        await dataFetch('/dynamic_map_data/rooms_floor1.json');
        await dataFetch('/api/files/ha/rooms_floor1.json');
        expect(session.mock.calls.map(c => c[0])).toEqual(['/dynamic_map_data/rooms_floor1.json']);
        expect(plain.mock.calls.map(c => c[0])).toEqual(['/api/files/ha/rooms_floor1.json']);
        plain.mockRestore();
    });

    it('a read before hass arrives waits for the session fetch', async () => {
        setDataFetch(null);
        const session = vi.fn(async () => ok());
        const pending = dataFetch('/dynamic_map_data/config_floor2.json');
        setDataFetch(session);
        await pending;
        expect(session).toHaveBeenCalledWith('/dynamic_map_data/config_floor2.json', undefined);
    });

    it('turns an HA picture into one cached blob URL; a failed read is retried', async () => {
        const session = vi.fn(async () => ok());
        setDataFetch(session);
        const a = await dataImageUrl('/dynamic_map_data/icons/cached.svg');
        const b = await dataImageUrl('/dynamic_map_data/icons/cached.svg');
        expect(a).toMatch(/^blob:/);
        expect(b).toBe(a);
        expect(session).toHaveBeenCalledTimes(1);

        const failing = vi.fn(async () => ({ ok: false }));
        setDataFetch(failing);
        expect(await dataImageUrl('/dynamic_map_data/icons/missing.svg')).toBe('');
        expect(await dataImageUrl('/dynamic_map_data/icons/missing.svg')).toBe('');
        expect(failing).toHaveBeenCalledTimes(2);
        expect(await dataImageUrl('/local/x.svg')).toBe('/local/x.svg');
    });

    it('setDataHref sets other URLs at once and HA files once read; the latest call wins', async () => {
        let release;
        setDataFetch(vi.fn((url) => (url.includes('slow')
            ? new Promise(r => { release = () => r(ok()); })
            : Promise.resolve(ok()))));
        const el = document.createElementNS(SVG, 'image');
        setDataHref(el, '/local/now.svg');
        expect(el.getAttribute('href')).toBe('/local/now.svg');

        setDataHref(el, '/dynamic_map_data/icons/slow.svg');
        setDataHref(el, '/dynamic_map_data/icons/fast.svg');
        await vi.waitFor(() => expect(el.getAttribute('href')).toMatch(/^blob:/));
        const fast = el.getAttribute('href');
        release();
        await new Promise(r => setTimeout(r, 0));
        expect(el.getAttribute('href')).toBe(fast);
    });
});

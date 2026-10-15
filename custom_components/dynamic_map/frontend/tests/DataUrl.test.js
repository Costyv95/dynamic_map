import { describe, it, expect, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { setDataBase, getDataBase, dataUrl, resolveDataUrl, DEFAULT_DATA_BASE } from '../shared/DataUrl.js?v=3.2.1';
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

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EditorStateManager } from '../editor/EditorStateManager.js';
import { ProxyTool } from '../editor/tools/ProxyTool.js';

const canvas = { imgW: 1000, imgH: 1000, toPercent: (x, y) => [x / 10, y / 10] };
const KITCHEN = { id: 'b4:bf:e9:c8:f6:5c', name: 'Kitchen Proxy', online: true };

function state() {
    const s = new EditorStateManager(vi.fn(), vi.fn());
    s.activeLayer = 'proxies';
    s.saveState();
    return s;
}

describe('proxy placement state', () => {
    it('a tap places the armed proxy at map percent, one undo step', () => {
        const s = state();
        const tool = new ProxyTool(canvas, s);
        s.placingProxy = KITCHEN;
        tool.onClick({ x: 123.456, y: 789 });
        expect(s.proxies).toEqual([{ id: KITCHEN.id, name: 'Kitchen Proxy', position: [12.35, 78.9] }]);
        expect(s.placingProxy).toBeNull();
        expect(s.selectedProxyId).toBe(KITCHEN.id);
        s.undo();
        expect(s.proxies).toEqual([]);
        s.redo();
        expect(s.proxies[0].position).toEqual([12.35, 78.9]);
    });

    it('placing an already placed proxy moves it instead of adding a second one', () => {
        const s = state();
        s.placeProxy(KITCHEN, [10, 10]);
        s.placeProxy(KITCHEN, [20, 30]);
        expect(s.proxies).toHaveLength(1);
        expect(s.proxies[0].position).toEqual([20, 30]);
    });

    it('dragging a marker moves it and saves once on release', () => {
        const s = state();
        s.placeProxy(KITCHEN, [10, 10]);
        const saves = s.historyManager.history.length;
        const tool = new ProxyTool(canvas, s);
        expect(tool.onDown({}, { kind: 'handle', handle: 'proxy', proxyId: KITCHEN.id })).toBe(true);
        tool.onMove({}, { x: 400, y: 1200 });   // off the canvas: clamped
        tool.onUp();
        expect(s.proxies[0].position).toEqual([40, 100]);
        expect(s.historyManager.history.length).toBe(saves + 1);
    });

    it('Delete removes the selected proxy; switching layer disarms placing', () => {
        const s = state();
        s.placeProxy(KITCHEN, [10, 10]);
        expect(s.deleteSelection()).toBe(true);
        expect(s.proxies).toEqual([]);
        s.placingProxy = KITCHEN;
        s.setActiveLayer('objects');
        expect(s.placingProxy).toBeNull();
    });
});

const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
const CONFIG = { rotation_mode: 'auto', ble_proxies: [{ id: 'aa:bb:cc:dd:ee:ff', name: 'Old Proxy', position: [5, 5] }] };

function mockFetch(url) {
    const json = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(data))) });
    if (url.includes('/api/dynamic_map/save')) return json({ success: true });
    if (url.includes('config_floor1')) return json(CONFIG);
    if (url.includes('rooms_floor1') || url.includes('shortcuts_floor1')) return json([]);
    if (url.includes('/api/dynamic_map/fingerprints')) return json({ success: true, fingerprints: [], trackers: [], proxies: [KITCHEN] });
    if (url.includes('/api/dynamic_map/floors')) return json({ success: true, floors: [1], version: 't' });
    return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
}

describe('Proxies layer in the real editor', () => {
    let app;
    afterEach(() => { clearTimeout(app._draftTimer); app.hassBridge.stop(); vi.restoreAllMocks(); });

    it('lists Bermuda proxies, places one and saves it in the floor config', async () => {
        document.body.innerHTML = body;
        localStorage.clear();
        window.__DM_EDITOR_NO_AUTOSTART = true;
        const saves = [];
        global.fetch = vi.fn((url, opts) => {
            if (String(url).includes('/api/dynamic_map/save')) saves.push(JSON.parse(opts.body));
            return mockFetch(String(url));
        });
        vi.spyOn(global, 'Image').mockImplementation(function () {
            const img = {};
            Object.defineProperty(img, 'src', { set() { setTimeout(() => img.onerror && img.onerror(), 0); } });
            return img;
        });
        const mod = await import('../editor.js');
        app = new mod.EditorApp();
        await app.loadFloor(1);
        await app.loadProxies();
        expect(app.state.proxies).toHaveLength(1);   // loaded from config_floor1.json

        app.state.setActiveLayer('proxies');
        app.ui.refresh();
        const panel = document.querySelector('#inspector').textContent;
        expect(panel).toContain('Kitchen Proxy');
        expect(panel).toContain('not in Bermuda');   // placed earlier, gone from Bermuda: still removable
        const place = [...document.querySelectorAll('#inspector button')].find(b => b.textContent === 'Place');
        place.click();
        expect(app.state.placingProxy.id).toBe(KITCHEN.id);
        app.router.proxyTool.onClick({ x: app.canvas.imgW / 2, y: app.canvas.imgH / 4 });
        expect(document.querySelectorAll('[data-handle="proxy"]').length).toBe(2);

        await app.save();
        const cfg = saves.find(c => c.filename === 'config_floor1.json');
        expect(cfg.content.ble_proxies).toEqual([
            CONFIG.ble_proxies[0],
            { id: KITCHEN.id, name: 'Kitchen Proxy', position: [50, 25] }
        ]);
    });
});

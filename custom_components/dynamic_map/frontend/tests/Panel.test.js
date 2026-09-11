import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Same module instance as the panel uses (query string is part of module identity).
import { ApiManager } from '../shared/ApiManager.js?v=3.2.1';

/**
 * The HA custom panel element: mounts the editor shell in its shadow root,
 * routes API calls through hass.fetchWithAuth and feeds hass to the preview.
 */
const ROOMS = [{ id: 'r1', name: 'Living', polygon: [[10, 10], [60, 10], [60, 50], [10, 50]] }];
const SHORTCUTS = [{ id: 's1', name: 'Lamp', type: 'light', entity_id: 'light.l', position: [30, 30], config: {} }];

function respond(url) {
    const json = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
    if (url.includes('rooms_floor1')) return json(ROOMS);
    if (url.includes('shortcuts_floor1')) return json(SHORTCUTS);
    if (url.includes('/api/dynamic_map/floors')) return json({ success: true, floors: [1], version: 't' });
    if (url.includes('/api/dynamic_map/registry')) return json({ success: true, areas: [], floors: [] });
    if (url.includes('/api/dynamic_map/entities')) return json({ success: true, entities: [] });
    if (url.includes('/api/dynamic_map/files')) return json({ success: true, files: [], icons: [] });
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
}

describe('dynamic-map-panel', () => {
    let hass, fetchWithAuth;
    beforeEach(async () => {
        document.body.innerHTML = '';
        window.__DM_EDITOR_NO_AUTOSTART = true;
        global.fetch = vi.fn((url) => respond(String(url)));
        fetchWithAuth = vi.fn((url) => respond(String(url)));
        hass = { states: { 'light.l': { state: 'on', attributes: {} } }, fetchWithAuth, callService: vi.fn() };
        vi.spyOn(global, 'Image').mockImplementation(function () {
            const img = { naturalWidth: 0, naturalHeight: 0 };
            Object.defineProperty(img, 'src', { set() { setTimeout(() => img.onerror && img.onerror(), 0); } });
            return img;
        });
        await import('../dynamic-map-panel.js');
    });
    afterEach(() => { ApiManager.setHass(null); vi.restoreAllMocks(); });

    it('mounts the editor shell in its shadow root and uses hass for API calls', async () => {
        const el = document.createElement('dynamic-map-panel');
        el.hass = hass;
        document.body.appendChild(el);
        await new Promise(r => setTimeout(r, 50));
        expect(el.shadowRoot.querySelector('#toolbar button')).toBeTruthy();
        expect(el.shadowRoot.querySelector('svg.dm-editor-svg')).toBeTruthy();
        expect(el.shadowRoot.querySelector('link[rel="stylesheet"]').getAttribute('href')).toContain('editor.css');
        expect(fetchWithAuth).toHaveBeenCalledWith(expect.stringContaining('/api/dynamic_map/floors'), expect.anything());
        expect(ApiManager.usesPanelHass).toBe(true);
        expect(el.app.hassBridge.timer).toBeNull();   // no parent-window polling in the panel
    });

    it('feeds hass into the preview so badges show live state', async () => {
        const el = document.createElement('dynamic-map-panel');
        document.body.appendChild(el);
        el.hass = hass;
        await new Promise(r => setTimeout(r, 50));
        const badge = el.app.canvas.shortcutElements.s1;
        expect(badge).toBeTruthy();
        expect(badge._glowVisible).toBe(true);
        expect(el.app.ui.toolbar.menuBtn).toBeTruthy();
        el.remove();
        expect(ApiManager.usesPanelHass).toBe(false);
    });
});

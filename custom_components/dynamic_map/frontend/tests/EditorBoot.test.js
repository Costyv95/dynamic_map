import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Boots the real editor entry (editor.html + editor.js) in jsdom with a
 * mocked backend, then drives it through its public objects. This is the
 * test ADR 012 asked for: it exercises the wiring, not a hand-built state.
 */
const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');

const ROOMS = [{ id: 'r1', name: 'Living', polygon: [[10, 10], [60, 10], [60, 50], [10, 50]], color: '#336699', entity_id: 'light.l' }];
const SHORTCUTS = [
    { id: 's1', name: 'Lamp', type: 'light', entity_id: 'light.l', position: [30, 30], config: { shape: 'circle', color: '#f59e0b' } },
    { id: 's2', name: 'Sofa', type: 'generic', position: [50, 40], scaleX: 3, scaleY: 2, config: { shape: 'rect', decor: true, transparent: true } }
];
const CONFIG = { rotation_mode: 'auto', walls: [{ id: 'w1', points: [[10, 60], [60, 60]], thickness: 8 }] };

function mockFetch(url) {
    const json = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    if (url.includes('rooms_floor1')) return json(ROOMS);
    if (url.includes('shortcuts_floor1')) return json(SHORTCUTS);
    if (url.includes('config_floor1')) return json(CONFIG);
    if (url.includes('/api/dynamic_map/floors')) return json({ success: true, floors: [1], version: 't' });
    if (url.includes('/api/dynamic_map/registry')) return json({ success: true, areas: [], floors: [] });
    if (url.includes('/api/dynamic_map/entities')) return json({ success: true, entities: [{ id: 'light.l', name: 'Lamp' }] });
    if (url.includes('/api/dynamic_map/files')) return json({ success: true, files: [], icons: [] });
    return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
}

async function boot() {
    document.body.innerHTML = body;
    localStorage.clear();   // no stale drafts between tests
    window.__DM_EDITOR_NO_AUTOSTART = true;
    global.fetch = vi.fn((url) => mockFetch(String(url)));
    // Images never load in jsdom: fire onerror so the editor uses fallback sizes.
    vi.spyOn(global, 'Image').mockImplementation(function () {
        const img = { naturalWidth: 0, naturalHeight: 0 };
        Object.defineProperty(img, 'src', { set() { setTimeout(() => img.onerror && img.onerror(), 0); } });
        return img;
    });
    const mod = await import('../editor.js');
    const app = new mod.EditorApp();
    await app.loadFloor(1);
    return app;
}

describe('editor boot through the real entry point', () => {
    let app;
    beforeEach(async () => { app = await boot(); });
    afterEach(() => { app.hassBridge.stop(); vi.restoreAllMocks(); });

    it('mounts the card scene: rooms, walls, decor and badges land in the SVG', () => {
        const svg = document.querySelector('svg.dm-editor-svg');
        expect(svg).toBeTruthy();
        expect(svg.querySelectorAll('polygon.room-polygon').length).toBe(1);
        expect(svg.querySelectorAll('.dm-walls path').length).toBe(1);
        expect(svg.querySelectorAll('.dm-decor-layer .shortcut-group').length).toBe(1);
        expect(svg.querySelectorAll('.shortcut-group').length).toBe(2);
        expect(svg.querySelector('.dm-edit-overlay')).toBeTruthy();
        expect(svg.getAttribute('viewBox')).toMatch(/^[-\d.]+ [-\d.]+ [\d.]+ [\d.]+$/);
    });

    it('never binds tap actions on badges in the editor', () => {
        const badge = app.canvas.shortcutElements.s1;
        expect(badge.mapContext.interactive).toBe(false);
        const hass = { states: {}, callService: vi.fn() };
        app.canvas.setHass(hass);
        badge.group.dispatchEvent(new Event('pointerdown'));
        badge.group.dispatchEvent(new Event('pointerup'));
        expect(hass.callService).not.toHaveBeenCalled();
    });

    it('selecting a badge draws its handles in the overlay', () => {
        app.state.selectedShortcutIdx = 0;
        app.canvas.refresh();
        const overlay = document.querySelector('.dm-edit-overlay');
        expect(overlay.querySelectorAll('[data-handle="N"], [data-handle="SE"], [data-handle="ROT"]').length).toBe(3);
        expect(overlay.textContent).toContain('Lamp');
    });

    it('wall drawing renders its preview through the real state -> overlay path (ADR 012)', () => {
        app.state.setActiveLayer('walls');
        app.state.drawingWall = [[10, 10], [40, 10]];
        app.state.wallCursor = { x: 600, y: 100 };
        app.canvas.refresh();
        const overlay = document.querySelector('.dm-edit-overlay');
        expect(overlay.querySelectorAll('polyline').length).toBe(1);
        expect(overlay.querySelectorAll('line').length).toBe(1);
        expect(overlay.querySelectorAll('circle').length).toBe(2);
    });

    it('previewing a state re-renders the badge with that state forced', () => {
        const sc = app.state.shortcuts[0];
        sc.config.states = [{ id: 'on', name: 'On', state_entity: 'light.l', operator: '==', value: 'on', color: '#00ff00' }];
        app.state.selectedShortcutIdx = 0;
        app.state.previewStateIdx = 0;
        app.canvas.refresh();
        const badge = app.canvas.shortcutElements.s1;
        expect(badge.forcedState).toBe(sc.config.states[0]);
        expect(badge.shape.getAttribute('fill')).toBe('#00ff00');
    });

    it('live hass drives the preview once the bridge hands it over', () => {
        app.hassBridge.setHass({ states: { 'light.l': { state: 'on', attributes: {} } } });
        const badge = app.canvas.shortcutElements.s1;
        expect(badge._glowVisible).toBe(true);
    });

    it('adding a shortcut rebuilds the scene; undo removes it again', () => {
        app.state.shortcuts.push({ id: 's3', name: 'New', type: 'generic', position: [20, 20], config: {} });
        app.state.saveState();
        app.canvas.refresh();
        expect(document.querySelectorAll('.shortcut-group').length).toBe(3);
        app.state.undo();
        expect(document.querySelectorAll('.shortcut-group').length).toBe(2);
    });

    it('the save payload carries the floor config with walls', async () => {
        const calls = [];
        global.fetch = vi.fn((url, opts) => {
            if (String(url).includes('/api/dynamic_map/save')) {
                calls.push(JSON.parse(opts.body));
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
            }
            return mockFetch(String(url));
        });
        await app.save();
        const cfg = calls.find(c => c.filename === 'config_floor1.json');
        expect(cfg.content.walls.length).toBe(1);
        expect(cfg.content.rotation_mode).toBe('auto');
    });
});

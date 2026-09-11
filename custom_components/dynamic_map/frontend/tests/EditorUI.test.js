import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { layoutsDiffer, copyLayout } from '../editor/ui/SizePanel.js';
import { applyRawJson } from '../editor/ui/RawJsonDialog.js';
import { stripRuntimeKeys } from '../shared/ApiManager.js';

const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
const ROOMS = [{ id: 'r1', name: 'Living', polygon: [[10, 10], [60, 10], [60, 50], [10, 50]], color: '#336699' }];
const SHORTCUTS = [
    { id: 's1', name: 'Lamp', type: 'light', entity_id: 'light.l', position: [30, 30], scaleX: 2, scaleY: 2, config: { shape: 'rect', proportional: false, color: '#f59e0b', states: [{ id: 'on', name: 'On', state_entity: 'light.l', operator: '==', value: 'on', color: '#00ff00' }] } },
    { id: 's2', name: 'Sofa', type: 'generic', position: [50, 40], config: { shape: 'rect', decor: true, transparent: true } }
];

function mockFetch(url) {
    const json = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    if (url.includes('rooms_floor1')) return json(ROOMS);
    if (url.includes('shortcuts_floor1')) return json(SHORTCUTS);
    if (url.includes('config_floor1')) return json({ rotation_mode: 'auto', walls: [] });
    if (url.includes('/api/dynamic_map/floors')) return json({ success: true, floors: [1, 2], version: 't' });
    return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
}

async function boot() {
    document.body.innerHTML = body;
    window.__DM_EDITOR_NO_AUTOSTART = true;
    global.fetch = vi.fn((url) => mockFetch(String(url)));
    vi.spyOn(global, 'Image').mockImplementation(function () {
        const img = { naturalWidth: 0, naturalHeight: 0 };
        Object.defineProperty(img, 'src', { set() { setTimeout(() => img.onerror && img.onerror(), 0); } });
        return img;
    });
    const mod = await import('../editor.js');
    const app = new mod.EditorApp();
    app.setFloors([1, 2]);
    await app.loadFloor(1);
    return app;
}

const inspector = () => document.getElementById('inspector');
const labels = () => [...inspector().querySelectorAll('.dm-field-label')].map(l => l.textContent.trim());

describe('editor UI', () => {
    let app;
    beforeEach(async () => { app = await boot(); });
    afterEach(() => { app.hassBridge.stop(); vi.restoreAllMocks(); });

    it('shows floor chips, layer and layout controls in the toolbar', () => {
        const tb = document.getElementById('toolbar');
        expect([...tb.querySelectorAll('[data-floor]')].map(b => b.dataset.floor)).toEqual(['1', '2']);
        expect(tb.querySelector('[data-value="objects"]').classList.contains('active')).toBe(true);
        expect(tb.querySelector('[data-value="horizontal"]').classList.contains('active')).toBe(true);
    });

    it('lists the layer items when nothing is selected and opens the object panel on selection', () => {
        expect(inspector().textContent).toContain('Lamp');
        app.state.selectedShortcutIdx = 0;
        app.ui.refresh();
        expect(labels()).toEqual(expect.arrayContaining(['Name', 'Entity', 'Type', 'Width', 'Height', 'Rotation °', 'Edits apply to']));
        expect(inspector().querySelector('input').value).toBe('Lamp');
    });

    it('the rooms layer turns on room editing and shows the room panel for a selection', () => {
        app.ui.toolbar.layerSeg.querySelector('[data-value="rooms"]').click();
        expect(app.state.isEditMode).toBe(true);
        expect(inspector().textContent).toContain('Draw a room');
        app.state.selectedRooms = [0];
        app.ui.refresh();
        expect(labels()).toEqual(expect.arrayContaining(['Name', 'Home Assistant area', 'Colour']));
    });

    it('editing the width writes the scale for both layouts and updates the badge', () => {
        app.state.selectedShortcutIdx = 0;
        app.ui.refresh();
        const width = [...inspector().querySelectorAll('.dm-field')].find(f => f.querySelector('.dm-field-label').textContent.trim() === 'Width').querySelector('input');
        width.value = '96';
        width.dispatchEvent(new Event('change'));
        const sc = app.state.shortcuts[0];
        expect(sc.scaleX).toEqual({ horizontal: 4, vertical: 4 });
        expect(app.canvas.shortcutElements.s1.shape.getAttribute('width')).toBe('96');
    });

    it('unlinking layouts from the size panel switches the write mode and shows the copy button', () => {
        app.state.selectedShortcutIdx = 0;
        app.ui.refresh();
        inspector().querySelector('[data-value="vertical"]').click();
        expect(app.canvas.linkOrientations).toBe(false);
        expect(app.canvas.activeMode).toBe('vertical');
        expect(inspector().textContent).toContain('Copy portrait → landscape');
    });

    it('previewing a state shows the editing badge and override markers', () => {
        app.state.selectedShortcutIdx = 0;
        app.ui.refresh();
        [...inspector().querySelectorAll('button')].find(b => b.textContent.includes('Preview')).click();
        expect(app.state.previewStateIdx).toBe(0);
        expect(inspector().textContent).toContain('Editing state: On');
        expect(inspector().querySelectorAll('.dm-badge.dm-inherit').length).toBeGreaterThan(0);
        expect(app.canvas.shortcutElements.s1.shape.getAttribute('fill')).toBe('#00ff00');
    });

    it('the walls layer shows the draw button and a status hint over the map', () => {
        app.ui.toolbar.layerSeg.querySelector('[data-value="walls"]').click();
        expect(app.state.drawingWall).toEqual([]);
        expect(document.querySelector('.dm-status').hidden).toBe(false);
        expect(inspector().textContent).toContain('Cancel drawing');
    });
});

describe('size panel helpers', () => {
    it('detects diverged layouts and copies one leg onto the other', () => {
        const sc = { position: { horizontal: [1, 1], vertical: [2, 2] }, scaleX: 2 };
        expect(layoutsDiffer(sc)).toBe(true);
        copyLayout(sc, 'horizontal', 'vertical');
        expect(sc.position.vertical).toEqual([1, 1]);
        expect(layoutsDiffer(sc)).toBe(false);
    });
});

describe('raw JSON and runtime keys', () => {
    it('lifts top-level keys out of a pasted config block', () => {
        const sc = { id: 'x', config: {} };
        applyRawJson(sc, { type: 'light', entity_id: 'light.a', color: '#fff' });
        expect(sc.type).toBe('light');
        expect(sc.config).toEqual({ color: '#fff' });
        applyRawJson(sc, { config: { icon: '💡' }, scaleX: 3 });
        expect(sc.config).toEqual({ icon: '💡' });
        expect(sc.scaleX).toBe(3);
    });

    it('stripRuntimeKeys drops _expanded and friends at any depth', () => {
        const out = stripRuntimeKeys([{ id: 'a', _expanded: true, config: { actions: [{ type: 'TOGGLE', _expanded: false }] } }]);
        expect(out).toEqual([{ id: 'a', config: { actions: [{ type: 'TOGGLE' }] } }]);
    });
});

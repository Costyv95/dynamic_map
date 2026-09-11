import { ApiManager } from './shared/ApiManager.js?v=3.2.1';
import { EditorCanvas } from './editor/EditorCanvas.js?v=3.2.1';
import { EditorStateManager } from './editor/EditorStateManager.js?v=3.2.1';
import { ToolRouter } from './editor/ToolRouter.js?v=3.2.1';
import { EditorUI } from './editor/EditorUI.js?v=3.2.1';
import { HassBridge } from './editor/HassBridge.js?v=3.2.1';
import { setupAutocomplete, fillEntityDatalist } from './editor/ui/EntityAutocomplete.js?v=3.2.1';
import { openAddFloorDialog } from './editor/ui/FloorDialogs.js?v=3.2.1';
import { loadIconList } from './editor/ui/RecomputeDialog.js?v=3.2.1';
import { newObject, newDecor } from './editor/ui/Presets.js?v=3.2.1';
import { setUiRoot, confirmDialog } from './editor/ui/Dialog.js?v=3.2.1';
import { DirtyTracker, writeDraft, readDraft, clearDraft, draftDiffers, formatAge } from './editor/Drafts.js?v=3.2.1';
import { isTyping } from './editor/Keys.js?v=3.2.1';

console.log('[DynamicMapDebug] Map Editor loaded (Version: 4.0.0)');

/**
 * Editor entry: wires the state manager, the SVG canvas (the card's own
 * scene + edit overlay), the tools and the UI. Exported as a class so the
 * custom panel and the smoke tests can boot it against any document.
 */
export class EditorApp {
    /** `root` is the document or a shadow root holding the app shell. */
    constructor(root = document) {
        this.root = root;
        setUiRoot(root === document ? document.body : root.querySelector('#dm-app') || root);
        this.container = root.querySelector('#canvas-container');
        this.state = new EditorStateManager(() => this.ui.refresh(), () => this.canvas.refresh());
        this.canvas = new EditorCanvas(this.container, this.state);
        this.canvas.linkOrientations = localStorage.getItem('dm_editor_link_orientations') !== 'false';
        // Start on the layout this device would show: a phone held upright edits portrait.
        if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < window.innerHeight) this.canvas.activeMode = 'vertical';
        this.router = new ToolRouter(this.canvas, this.state);
        this.ui = new EditorUI(this);
        this.hassBridge = new HassBridge((hass) => this.canvas.setHass(hass));
        this.floors = [];
        this.dirty = new DirtyTracker();
        this.dirty.onChange(() => this.ui.toolbar.sync());
        this.state.onRevision = () => { this.dirty.bump(); this.scheduleDraft(); };
        this.bindGlobals();
    }

    /** Write the floor draft shortly after the last change. */
    scheduleDraft() {
        clearTimeout(this._draftTimer);
        this._draftTimer = setTimeout(() => {
            if (!this.dirty.dirty) return;
            writeDraft(this.state.activeFloor, { rooms: this.state.rooms, shortcuts: this.state.shortcuts, walls: this.state.walls, config: this.floorConfig() });
        }, 400);
    }

    /** What the inspector panels get. */
    ctx() {
        return {
            app: this, state: this.state, canvas: this.canvas,
            refresh: () => this.ui.refresh(),
            select: () => { this.ui.refresh(); this.state.requestDrawCallback(); },
            syncLists: () => this.ui.refresh()
        };
    }

    /** The per-floor config block as saved next to rooms/shortcuts. */
    floorConfig(extra = {}) {
        const c = this.canvas;
        return {
            rotation_mode: c.rotationMode, flips: c.flips,
            name: this.state.floorName || undefined,
            background_color: c.backgroundColor || undefined,
            background_mode: c.backgroundMode !== 'image' ? c.backgroundMode : undefined,
            walls: this.state.walls.length ? this.state.walls : undefined,
            ...extra
        };
    }

    async save(extra = {}) {
        await ApiManager.saveToHA(this.state.activeFloor, this.state.rooms, this.state.shortcuts, this.floorConfig(extra));
        this.dirty.markSaved();
        clearDraft(this.state.activeFloor);
    }

    async saveWithFeedback() {
        try {
            await this.save();
            this.ui.toast('Saved to Home Assistant.', 'ok');
        } catch (err) {
            this.ui.toast(`Save failed: ${err.message}`, 'error');
        }
    }

    setFloors(floors, names) {
        this.floors = floors;
        if (names) this.floorNames = names;
        this.ui.toolbar.setFloors(floors, this.state.activeFloor, this.floorNames || {});
    }

    floorLabel(n) {
        const names = this.floorNames || {};
        return names[String(n)] || `Floor ${n}`;
    }

    /** Rename the active floor (stored as `name` in its config file). */
    async renameFloor(name) {
        const n = String(this.state.activeFloor);
        const clean = (name || '').trim();
        this.floorNames = { ...(this.floorNames || {}) };
        if (clean) this.floorNames[n] = clean; else delete this.floorNames[n];
        this.state.floorName = clean || undefined;
        await this.save();
        this.setFloors(this.floors);
    }

    async switchFloor(n) {
        if (this.loadedFloor !== undefined && String(n) === String(this.loadedFloor)) return;
        if (this.dirty.dirty) {
            const ok = await confirmDialog('Unsaved changes', `Save floor ${this.state.activeFloor} before switching?`, { okLabel: 'Save and switch' });
            if (ok) { try { await this.save(); } catch (e) { this.ui.toast(`Save failed: ${e.message}`, 'error'); return; } }
            // Not saving keeps the local draft, so nothing is lost either way.
        }
        this.ui.toolbar.setActiveFloor(n);
        return this.loadFloor(n);
    }

    addFloor() { return openAddFloorDialog(this); }

    async loadFloor(floorNum) {
        const state = this.state;
        state.activeFloor = floorNum;
        localStorage.setItem('dm_editor_last_floor', String(floorNum));
        const bgUrl = `/dynamic_map_data/bg_floor${floorNum}.png?t=${Date.now()}`;
        const [dims, data] = await Promise.all([this.loadImageSize(bgUrl), this.loadFloorJson(floorNum)]);
        const draft = readDraft(floorNum);
        let restored = false;
        if (draftDiffers(draft, data)) {
            restored = await confirmDialog('Unsaved changes found', `This floor has unsaved edits from ${formatAge(draft.ts)}. Restore them?`, { okLabel: 'Restore' });
            if (!restored) clearDraft(floorNum);
        }
        const src = restored ? draft : data;
        state.rooms = src.rooms || [];
        state.shortcuts = src.shortcuts || [];
        state.walls = (src.config && src.config.walls) || (restored ? src.walls : []) || [];
        state.floorName = (data.config && data.config.name) || undefined;
        state.selectedRooms = [];
        state.selectedShortcutIdx = -1;
        state.selectedWallIdx = -1;
        state.previewStateIdx = -1;
        state.historyManager.reset();
        this.dirty.reset();
        state.saveState();
        if (restored) this.dirty.bump(); else this.dirty.markSaved();
        this.canvas.loadFloor({ bgUrl, imgW: dims.w, imgH: dims.h, config: restored ? { ...(data.config || {}), ...(draft.config || {}) } : data.config });
        this.loadedFloor = floorNum;
        this.ui.toolbar.setActiveFloor(floorNum);
        this.ui.refresh();
    }

    loadImageSize(url) {
        return new Promise((resolve) => {
            const img = this.state.bgImage;
            img.onload = () => resolve({ w: img.naturalWidth || 1280, h: img.naturalHeight || 1920 });
            img.onerror = () => resolve({ w: 1280, h: 1920 });   // keep the editor usable
            img.src = url;
        });
    }

    async loadFloorJson(floorNum) {
        try {
            return await ApiManager.fetchFloorData(floorNum);
        } catch (err) {
            console.error('[DynamicMapDebug] Failed to load floor JSON', err);
            return { rooms: [], shortcuts: [], config: null };
        }
    }

    /** Simulated layout being edited: 'horizontal' | 'vertical'. */
    setLayout(mode) {
        this.canvas.activeMode = mode;
        this.canvas.layout();
        this.canvas.refreshAll();
        this.ui.refresh();
    }

    /** Linked = edits write to both layouts. */
    setLinked(on) {
        this.canvas.linkOrientations = on;
        localStorage.setItem('dm_editor_link_orientations', String(on));
        this.ui.refresh();
    }

    addShortcut(sc, layer) {
        this.state.setActiveLayer(layer);
        this.state.shortcuts.push(sc);
        this.state.selectedShortcutIdx = this.state.shortcuts.length - 1;
        this.state.selectedRooms = [];
        this.state.saveState();
        this.ui.refresh();
        this.state.requestDrawCallback();
    }

    addObject() { this.addShortcut(newObject(localStorage.getItem('lastShortcutColor')), 'objects'); }
    addDecor() { this.addShortcut(newDecor(), 'decor'); }

    /** Wraps `input` with an entity dropdown; returns the element to place. */
    attachAutocomplete(input) {
        return setupAutocomplete(input, () => this.state.allEntities) || input;
    }

    bindGlobals() {
        window.addEventListener('beforeunload', (e) => {
            if (!this.dirty.dirty) return;
            e.preventDefault();
            e.returnValue = '';
        });
        window.togglePreviewState = (idx) => {
            const res = this.state.togglePreviewState(idx);
            window.previewStateIdx = res;
            return res;
        };
        document.addEventListener('keydown', (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            if (isTyping(e)) return;
            if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.state.undo(); }
            if (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); this.state.redo(); }
            if (e.key === 's') { e.preventDefault(); this.saveWithFeedback(); }
        });
    }

    async discoverFloors() {
        let floors = [];
        try {
            const data = await ApiManager.fetchFloors();
            if (data.success && Array.isArray(data.floors)) floors = data.floors;
            if (data.names) this.floorNames = data.names;
            const brand = this.root.querySelector('.dm-brand');
            if (data.version && brand) brand.title = `Dynamic Map v${data.version}`;
        } catch (err) {
            console.warn('[editor] Floor discovery failed:', err.message);
        }
        if (!floors.length) {
            // Authenticated API unavailable (companion-app webview without a
            // web session): probe the public data files instead.
            const t = Date.now();
            const probes = await Promise.all([...Array(12)].map((_, i) =>
                fetch(`/dynamic_map_data/rooms_floor${i + 1}.json?t=${t}`, { method: 'HEAD' })
                    .then(r => (r.ok ? i + 1 : null)).catch(() => null)));
            floors = probes.filter(Boolean);
        }
        if (!floors.length) floors = [1];
        this.setFloors(floors);
        const remembered = parseInt(localStorage.getItem('dm_editor_last_floor'));
        return this.switchFloor(floors.includes(remembered) ? remembered : floors[floors.length - 1]);
    }

    async loadRegistry() {
        try {
            const data = await ApiManager.fetchRegistry();
            if (!data.success) return;
            this.state.haAreas = data.areas;
            this.state.haFloors = data.floors;
        } catch (err) {
            console.warn('[editor] Failed to load HA registry:', err.message);
        }
    }

    async loadEntities() {
        try {
            const data = await ApiManager.fetchEntities();
            if (!(data.success && data.entities)) return;
            this.state.allEntities = data.entities;
            fillEntityDatalist(data.entities, this.root);
        } catch (err) {
            console.warn('[editor] Failed to load entities for autocomplete:', err.message);
        }
    }

    /** pollHass: read the parent app's hass (iframe mode); the panel hands hass in itself. */
    start({ pollHass = true } = {}) {
        this.loadRegistry();
        loadIconList(this.root);
        this.discoverFloors();
        this.loadEntities();
        if (pollHass) this.hassBridge.startPolling();
        return this;
    }
}

// Standalone page (editor.html) boots itself; the HA custom panel imports
// this module and mounts the app into its own shadow root instead.
if (typeof document !== 'undefined' && document.getElementById('dm-app') && !window.__DM_EDITOR_NO_AUTOSTART) {
    window.dmEditor = new EditorApp().start();
}

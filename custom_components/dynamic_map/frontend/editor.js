import { ApiManager } from './shared/ApiManager.js?v=3.2.1';
import { EditorCanvas } from './editor/EditorCanvas.js?v=3.2.1';
import { EditorStateManager } from './editor/EditorStateManager.js?v=3.2.1';
import { ToolRouter } from './editor/ToolRouter.js?v=3.2.1';
import { EditorUIManager } from './editor/EditorUIManager.js?v=3.2.1';
import { HassBridge } from './editor/HassBridge.js?v=3.2.1';
import { bindFloorControls, initFloors, listedFloors } from './editor/ui/FloorControls.js?v=3.2.1';
import { bindOutsideDialog } from './editor/ui/OutsideDialog.js?v=3.2.1';
import { bindRecomputePanel, loadAvailableFiles } from './editor/ui/RecomputePanel.js?v=3.2.1';
import { setupAutocomplete, fillEntityDatalist } from './editor/ui/EntityAutocomplete.js?v=3.2.1';

console.log('[DynamicMapDebug] Map Editor loaded (Version: 3.3.0)');

/**
 * Editor entry: wires the state manager, the SVG canvas (the card's own
 * scene + edit overlay), the tools and the sidebar. Exported as a class
 * so the custom panel and the smoke tests can boot it against any root.
 */
export class EditorApp {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.state = new EditorStateManager(() => this.ui.updateSidebar(), () => this.canvas.refresh());
        this.canvas = new EditorCanvas(this.container, this.state);
        this.router = new ToolRouter(this.canvas, this.state);
        this.ui = new EditorUIManager(this.state, this.canvas);
        this.hassBridge = new HassBridge((hass) => this.canvas.setHass(hass));
        this.bindGlobals();
        this.bindToolbar();
        bindFloorControls(this);
        bindOutsideDialog();
        bindRecomputePanel();
    }

    /** The per-floor config block as saved next to rooms/shortcuts. */
    floorConfig(extra = {}) {
        const c = this.canvas;
        return {
            rotation_mode: c.rotationMode, flips: c.flips,
            background_color: c.backgroundColor || undefined,
            background_mode: c.backgroundMode !== 'image' ? c.backgroundMode : undefined,
            walls: this.state.walls.length ? this.state.walls : undefined,
            ...extra
        };
    }

    save(extra = {}) {
        return ApiManager.saveToHA(this.state.activeFloor, this.state.rooms, this.state.shortcuts, this.floorConfig(extra));
    }

    async loadFloor(floorNum) {
        const state = this.state;
        state.activeFloor = floorNum;
        localStorage.setItem('dm_editor_last_floor', String(floorNum));
        const bgUrl = `/dynamic_map_data/bg_floor${floorNum}.png?t=${Date.now()}`;
        const [dims, data] = await Promise.all([this.loadImageSize(bgUrl), this.loadFloorJson(floorNum)]);
        state.rooms = data.rooms || [];
        state.shortcuts = data.shortcuts || [];
        state.walls = (data.config && data.config.walls) || [];
        state.selectedRooms = [];
        state.selectedShortcutIdx = -1;
        state.selectedWallIdx = -1;
        state.saveState();
        this.canvas.loadFloor({ bgUrl, imgW: dims.w, imgH: dims.h, config: data.config });
        this.ui.updateRotationUI();
        this.ui.updateSidebar();
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

    bindGlobals() {
        window.togglePreviewState = (idx) => {
            const res = this.state.togglePreviewState(idx);
            window.previewStateIdx = res;
            return res;
        };
        document.addEventListener('keydown', (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.state.undo(); }
            if (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); this.state.redo(); }
        });
        this.bindResizer();
    }

    bindResizer() {
        const resizer = document.getElementById('resizer');
        const sidebar = document.getElementById('sidebar');
        if (!resizer) return;
        let startX, startY, startW, startH;
        const narrow = () => window.innerWidth <= 768;
        resizer.addEventListener('pointerdown', (e) => {
            const rect = sidebar.getBoundingClientRect();
            startW = rect.width; startH = rect.height;
            startX = e.clientX; startY = e.clientY;
            resizer.setPointerCapture(e.pointerId);
            resizer.classList.add('resizing');
            e.preventDefault();
        });
        resizer.addEventListener('pointermove', (e) => {
            if (!resizer.hasPointerCapture(e.pointerId)) return;
            if (narrow()) {
                sidebar.style.height = `${Math.max(100, Math.min(window.innerHeight - 100, startH + (e.clientY - startY)))}px`;
                sidebar.style.maxHeight = 'none';
            } else {
                sidebar.style.width = `${Math.max(200, Math.min(window.innerWidth - 200, startW + (e.clientX - startX)))}px`;
            }
        });
        resizer.addEventListener('pointerup', (e) => {
            resizer.releasePointerCapture(e.pointerId);
            resizer.classList.remove('resizing');
            this.canvas.layout();
        });
    }

    bindToolbar() {
        const canvas = this.canvas;
        document.getElementById('undoBtn').addEventListener('click', () => this.state.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.state.redo());
        document.getElementById('exportJsonBtn').addEventListener('click', async () => {
            if (this.state.selectedRooms.length === 1) this.ui.saveRoomName();
            const btn = document.getElementById('exportJsonBtn');
            btn.textContent = 'Saving to HA...';
            try {
                await this.save();
                btn.textContent = '✅ Saved to HA Successfully!';
            } catch (err) {
                btn.textContent = '❌ Save Failed';
            }
            setTimeout(() => { btn.textContent = '💾 Save JSON'; }, 3000);
        });
        document.getElementById('exportYamlBtn').addEventListener('click', () => {
            const floors = listedFloors();
            const vacuum = (this.state.shortcuts || []).find(sc => sc.type === 'vacuum' && sc.entity_id);
            let yaml = `type: custom:custom-svg-map\ndefault_floor: ${this.state.activeFloor}\n`;
            if (floors.length) yaml += `floors: [${floors.join(', ')}]\n`;
            if (vacuum) yaml += `vacuum_entity: ${vacuum.entity_id}\n`;
            document.getElementById('yamlOutput').value = yaml;
        });

        // Orientation linking: ON = edits write to BOTH layouts.
        const linkBtn = document.getElementById('linkOrientationsBtn');
        canvas.linkOrientations = localStorage.getItem('dm_editor_link_orientations') !== 'false';
        const renderLinkBtn = () => {
            linkBtn.classList.toggle('active', canvas.linkOrientations);
            linkBtn.textContent = canvas.linkOrientations ? '🔗' : '⛓️';
            linkBtn.title = canvas.linkOrientations
                ? 'Linked: moves/resizes apply to BOTH orientations. Click to unlink and edit only the active one.'
                : 'Unlinked: edits only affect the active orientation. Click to link both again.';
        };
        renderLinkBtn();
        linkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            canvas.linkOrientations = !canvas.linkOrientations;
            localStorage.setItem('dm_editor_link_orientations', String(canvas.linkOrientations));
            renderLinkBtn();
        });
        const setLayout = (mode) => {
            document.getElementById('toggleHorizontalBtn').classList.toggle('active', mode === 'horizontal');
            document.getElementById('toggleVerticalBtn').classList.toggle('active', mode === 'vertical');
            canvas.activeMode = mode;
            canvas.layout();
            canvas.refreshAll();
            this.ui.updateSidebar();
        };
        document.getElementById('toggleHorizontalBtn').addEventListener('click', () => setLayout('horizontal'));
        document.getElementById('toggleVerticalBtn').addEventListener('click', () => setLayout('vertical'));
    }

    async loadRegistry() {
        try {
            const data = await ApiManager.fetchRegistry();
            if (!data.success) return;
            this.state.haAreas = data.areas;
            this.state.haFloors = data.floors;
            const select = document.getElementById('roomArea');
            select.innerHTML = '<option value="">-- Unmapped --</option>';
            this.state.haAreas.forEach(a => { select.innerHTML += `<option value="${a.id}">${a.name}</option>`; });
        } catch (err) {
            console.warn('[editor] Failed to load HA registry:', err.message);
        }
    }

    async loadEntities() {
        try {
            const data = await ApiManager.fetchEntities();
            if (!(data.success && data.entities)) return;
            this.state.allEntities = data.entities;
            const get = () => this.state.allEntities;
            setupAutocomplete(document.getElementById('roomEntity'), get);
            setupAutocomplete(document.getElementById('scEntity'), get);
            fillEntityDatalist(data.entities);
        } catch (err) {
            console.warn('[editor] Failed to load entities for autocomplete:', err.message);
        }
    }

    start() {
        document.getElementById('roomArea').addEventListener('change', (e) => {
            const area = this.state.haAreas.find(a => a.id === e.target.value);
            const entInput = document.getElementById('roomEntity');
            if (area && area.default_light && !entInput.value) entInput.value = area.default_light;
        });
        this.loadRegistry();
        loadAvailableFiles();
        initFloors(this);
        this.loadEntities();
        this.hassBridge.startPolling();
        return this;
    }
}

if (typeof window !== 'undefined' && !window.__DM_EDITOR_NO_AUTOSTART) {
    window.dmEditor = new EditorApp().start();
}

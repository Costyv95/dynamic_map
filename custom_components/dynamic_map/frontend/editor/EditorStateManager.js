import { HistoryManager } from './HistoryManager.js?v=3.2.1';
import { ApiManager } from '../shared/ApiManager.js?v=3.2.1';

export class EditorStateManager {
    constructor(updateUICallback, requestDrawCallback) {
        this.historyManager = new HistoryManager();
        this.updateUICallback = updateUICallback;
        this.requestDrawCallback = requestDrawCallback;

        this.haAreas = [];
        this.haFloors = [];
        this.bgImage = new Image();
        this.rooms = [];
        this.selectedRooms = [];
        this.selectedVertex = null; // { roomIdx, vertexIdx } while dragging a room vertex
        this.drawingPolygon = null; // in-progress polygon points (%) while drawing a new room
        this.shortcuts = [];
        this.selectedShortcutIdx = -1;
        this.selectedExtra = [];   // more selected badge indices (multi-select), primary excluded
        this.isEditMode = false;
        // Which layer is being edited: 'objects' (interactive shortcuts),
        // 'decor' (scenery, config.decor) or 'walls'. Hit-testing only
        // selects items on the active layer, so furniture never steals
        // clicks from badges and vice versa.
        this.activeLayer = 'objects';
        // Walls: polylines with thickness, persisted in config_floorN.json.
        this.walls = [];
        this.selectedWallIdx = -1;
        this.drawingWall = null;   // in-progress points while the wall tool is armed
        this.wallCursor = null;    // live map-px cursor for the drawing preview
        
        // Split/Edit states
        this.isSplitting = false;
        this.splitStart = null;
        this.splitEnd = null;
        
        // Preview states
        this.previewStateIdx = -1;
        this.lastFetchedVacuumOptions = [];
        
        this.activeFloor = '2';
        this.isTransitioning = false;
        
        // API Data
        this.allEntities = [];
    }

    saveState() {
        this.historyManager.saveState(this.rooms, this.shortcuts, this.walls);
        if (this.onRevision) this.onRevision();
    }

    undo() {
        const state = this.historyManager.undo();
        if (state) {
            this.rooms = state.rooms;
            this.shortcuts = state.shortcuts;
            this.walls = state.walls || [];
            this.selectedRooms = [];
            this.selectedWallIdx = -1;
            if(this.updateUICallback) this.updateUICallback();
            if(this.requestDrawCallback) this.requestDrawCallback();
        }
    }

    redo() {
        const state = this.historyManager.redo();
        if (state) {
            this.rooms = state.rooms;
            this.shortcuts = state.shortcuts;
            this.walls = state.walls || [];
            this.selectedRooms = [];
            this.selectedWallIdx = -1;
            if(this.updateUICallback) this.updateUICallback();
            if(this.requestDrawCallback) this.requestDrawCallback();
        }
    }

    togglePreviewState(idx) {
        if (this.previewStateIdx === idx) {
            this.previewStateIdx = -1;
        } else {
            this.previewStateIdx = idx;
        }
        if(this.requestDrawCallback) this.requestDrawCallback();
        return this.previewStateIdx;
    }

    /**
     * Deep-copy the selected shortcut (decor or object) right next to the
     * original and select the copy. Runtime caches are stripped; per-
     * orientation positions are offset in both layouts so the copy is
     * visibly separate wherever you look.
     */
    duplicateSelectedShortcut() {
        const src = this.shortcuts[this.selectedShortcutIdx];
        if (!src) return null;
        const copy = cloneNudged(src, 0);
        this.shortcuts.push(copy);
        this.selectedShortcutIdx = this.shortcuts.length - 1;
        this.saveState();
        if (this.updateUICallback) this.updateUICallback();
        if (this.requestDrawCallback) this.requestDrawCallback();
        return copy;
    }

    /** Ctrl+D: duplicate every selected badge; the copies become the selection. */
    duplicateSelection() {
        const idxs = this.selectionIndices();
        if (idxs.length <= 1) return this.duplicateSelectedShortcut() ? 1 : 0;
        const copies = idxs.map((i, n) => cloneNudged(this.shortcuts[i], n));
        const first = this.shortcuts.length;
        this.shortcuts.push(...copies);
        this.selectedShortcutIdx = first;
        this.selectedExtra = copies.slice(1).map((_, n) => first + 1 + n);
        this.saveState();
        if (this.updateUICallback) this.updateUICallback();
        if (this.requestDrawCallback) this.requestDrawCallback();
        return copies.length;
    }

    /**
     * Delete whatever is currently selected — wall, shortcut (object/decor)
     * or room(s). Keyboard twin of the sidebar 🗑️ buttons.
     * Returns true if something was removed.
     */
    /** Primary first, then the extra selection, all valid. */
    selectionIndices() {
        const out = [];
        if (this.selectedShortcutIdx !== -1 && this.shortcuts[this.selectedShortcutIdx]) out.push(this.selectedShortcutIdx);
        (this.selectedExtra || []).forEach(i => { if (i !== this.selectedShortcutIdx && this.shortcuts[i] && !out.includes(i)) out.push(i); });
        return out;
    }

    clearExtraSelection() { this.selectedExtra = []; }

    /** Shift-click: add, or remove when already selected (promoting an extra if the primary goes). */
    toggleExtraSelection(idx) {
        if (idx === this.selectedShortcutIdx) {
            if (this.selectedExtra.length) { this.selectedShortcutIdx = this.selectedExtra.shift(); } else { this.selectedShortcutIdx = -1; }
        } else if (this.selectedShortcutIdx === -1) {
            this.selectedShortcutIdx = idx;
        } else if (this.selectedExtra.includes(idx)) {
            this.selectedExtra = this.selectedExtra.filter(i => i !== idx);
        } else {
            this.selectedExtra.push(idx);
        }
        if (this.updateUICallback) this.updateUICallback();
        if (this.requestDrawCallback) this.requestDrawCallback();
    }

    deleteSelection() {
        if (this.activeLayer === 'walls') {
            if (this.selectedWallIdx === -1) return false;
            this.walls.splice(this.selectedWallIdx, 1);
            this.selectedWallIdx = -1;
        } else if (this.selectedShortcutIdx !== -1) {
            this.selectionIndices().sort((a, b) => b - a).forEach(i => this.shortcuts.splice(i, 1));
            this.selectedShortcutIdx = -1;
            this.selectedExtra = [];
        } else if (this.selectedRooms.length) {
            [...this.selectedRooms].sort((a, b) => b - a)
                .forEach(i => this.rooms.splice(i, 1));
            this.selectedRooms = [];
        } else {
            return false;
        }
        this.saveState();
        if (this.updateUICallback) this.updateUICallback();
        if (this.requestDrawCallback) this.requestDrawCallback();
        return true;
    }

    /**
     * Layers: 'rooms' | 'objects' | 'decor' | 'walls'. Rooms are editable
     * (corner handles, drawing, split, delete) only on the rooms layer;
     * `isEditMode` mirrors that for the tools.
     */
    setActiveLayer(layer) {
        if (this.activeLayer === layer) return;
        this.activeLayer = layer;
        this.isEditMode = layer === 'rooms';
        this.selectedShortcutIdx = -1;
        this.selectedExtra = [];
        this.selectedWallIdx = -1;
        this.drawingWall = null;
        this.drawingPolygon = null;
        if (layer !== 'rooms') this.selectedRooms = [];
        if (this.updateUICallback) this.updateUICallback();
        if (this.requestDrawCallback) this.requestDrawCallback();
    }

    /** Kept for callers that still think in edit-mode terms. */
    setEditMode(mode) {
        this.setActiveLayer(mode ? 'rooms' : 'objects');
    }
}

/** Deep copy of a shortcut, moved 2% right/down, with a fresh id and a "copy" name. */
function cloneNudged(src, n = 0) {
    const copy = JSON.parse(JSON.stringify(src, (key, value) => (key === '_imgCache' || key === '_sensorHalfW' ? undefined : value)));
    copy.id = `sc_${Date.now()}_${n}`;
    copy.name = `${src.name || 'Shortcut'} copy`;
    const nudge = (pos) => [Math.min(pos[0] + 2, 100), Math.min(pos[1] + 2, 100)];
    if (Array.isArray(copy.position)) copy.position = nudge(copy.position);
    else if (copy.position && typeof copy.position === 'object') { for (const k of Object.keys(copy.position)) if (Array.isArray(copy.position[k])) copy.position[k] = nudge(copy.position[k]); }
    else copy.position = [52, 52];
    return copy;
}

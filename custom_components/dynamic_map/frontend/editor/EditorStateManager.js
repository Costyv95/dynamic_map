import { HistoryManager } from './HistoryManager.js?v=3.2.0';
import { ApiManager } from '../shared/ApiManager.js?v=3.2.0';

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
        const copy = JSON.parse(JSON.stringify(src, (key, value) =>
            key === '_imgCache' || key === '_sensorHalfW' ? undefined : value));
        copy.id = `sc_${Date.now()}`;
        copy.name = `${src.name || 'Shortcut'} copy`;
        const nudge = (pos) => [Math.min(pos[0] + 2, 100), Math.min(pos[1] + 2, 100)];
        if (Array.isArray(copy.position)) {
            copy.position = nudge(copy.position);
        } else if (copy.position && typeof copy.position === 'object') {
            for (const k of Object.keys(copy.position)) {
                if (Array.isArray(copy.position[k])) copy.position[k] = nudge(copy.position[k]);
            }
        } else {
            copy.position = [52, 52];
        }
        this.shortcuts.push(copy);
        this.selectedShortcutIdx = this.shortcuts.length - 1;
        this.saveState();
        if (this.updateUICallback) this.updateUICallback();
        if (this.requestDrawCallback) this.requestDrawCallback();
        return copy;
    }

    setActiveLayer(layer) {
        if (this.activeLayer === layer) return;
        this.activeLayer = layer;
        this.selectedShortcutIdx = -1;
        this.selectedWallIdx = -1;
        this.drawingWall = null;
        if (this.updateUICallback) this.updateUICallback();
        if (this.requestDrawCallback) this.requestDrawCallback();
    }

    setEditMode(mode) {
        this.isEditMode = mode;
        if (!this.isEditMode) {
            this.selectedRooms = [];
            this.selectedShortcutIdx = -1;
        }
        if(this.updateUICallback) this.updateUICallback();
        if(this.requestDrawCallback) this.requestDrawCallback();
    }
}

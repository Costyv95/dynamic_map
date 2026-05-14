import { HistoryManager } from './HistoryManager.js?v=2.67';
import { ApiManager } from './ApiManager.js?v=2.67';

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
        this.shortcuts = [];
        this.selectedShortcutIdx = -1;
        this.isEditMode = false;
        
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
        this.historyManager.saveState(this.rooms, this.shortcuts);
    }

    undo() {
        const state = this.historyManager.undo();
        if (state) {
            this.rooms = state.rooms;
            this.shortcuts = state.shortcuts;
            this.selectedRooms = [];
            if(this.updateUICallback) this.updateUICallback();
            if(this.requestDrawCallback) this.requestDrawCallback();
        }
    }

    redo() {
        const state = this.historyManager.redo();
        if (state) {
            this.rooms = state.rooms;
            this.shortcuts = state.shortcuts;
            this.selectedRooms = [];
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

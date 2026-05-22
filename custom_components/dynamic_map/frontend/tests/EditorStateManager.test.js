import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorStateManager } from '../editor/EditorStateManager.js';

describe('EditorStateManager', () => {
    let updateUICallback;
    let requestDrawCallback;
    let manager;

    beforeEach(() => {
        updateUICallback = vi.fn();
        requestDrawCallback = vi.fn();
        manager = new EditorStateManager(updateUICallback, requestDrawCallback);
    });

    it('should initialize with default states and properties correctly', () => {
        expect(manager.haAreas).toEqual([]);
        expect(manager.haFloors).toEqual([]);
        expect(manager.rooms).toEqual([]);
        expect(manager.selectedRooms).toEqual([]);
        expect(manager.shortcuts).toEqual([]);
        expect(manager.selectedShortcutIdx).toBe(-1);
        expect(manager.isEditMode).toBe(false);
        expect(manager.isSplitting).toBe(false);
        expect(manager.splitStart).toBeNull();
        expect(manager.splitEnd).toBeNull();
        expect(manager.previewStateIdx).toBe(-1);
        expect(manager.lastFetchedVacuumOptions).toEqual([]);
        expect(manager.activeFloor).toBe('2');
        expect(manager.isTransitioning).toBe(false);
        expect(manager.allEntities).toEqual([]);
        expect(manager.bgImage).toBeInstanceOf(window.Image);
    });

    it('should correctly save current state to HistoryManager', () => {
        manager.rooms = [{ id: 'room_1', name: 'Kitchen' }];
        manager.shortcuts = [{ id: 'sc_1', name: 'Lamp' }];
        
        manager.saveState();
        
        // Assert state is pushed in historyManager
        expect(manager.historyManager.history.length).toBe(1);
        expect(manager.historyManager.history[0].rooms).toEqual(manager.rooms);
        expect(manager.historyManager.history[0].shortcuts).toEqual(manager.shortcuts);
    });

    it('should correctly undo to a previous state and invoke callbacks', () => {
        // Save initial state
        manager.saveState();
        
        // Modify and save new state
        manager.rooms = [{ id: 'room_1', name: 'Kitchen' }];
        manager.shortcuts = [{ id: 'sc_1', name: 'Lamp' }];
        manager.saveState();
        
        expect(manager.historyManager.history.length).toBe(2);
        
        manager.selectedRooms = ['room_1'];
        updateUICallback.mockClear();
        requestDrawCallback.mockClear();

        manager.undo();
        
        // Assert state restored to initial empty state
        expect(manager.rooms).toEqual([]);
        expect(manager.shortcuts).toEqual([]);
        expect(manager.selectedRooms).toEqual([]);
        expect(updateUICallback).toHaveBeenCalledTimes(1);
        expect(requestDrawCallback).toHaveBeenCalledTimes(1);
    });

    it('should do nothing and not call callbacks if there is no undo state', () => {
        updateUICallback.mockClear();
        requestDrawCallback.mockClear();
        
        manager.undo();
        
        expect(updateUICallback).not.toHaveBeenCalled();
        expect(requestDrawCallback).not.toHaveBeenCalled();
    });

    it('should correctly redo a previously undone state and invoke callbacks', () => {
        manager.saveState(); // state 1: empty
        
        manager.rooms = [{ id: 'room_1', name: 'Kitchen' }];
        manager.shortcuts = [{ id: 'sc_1', name: 'Lamp' }];
        manager.saveState(); // state 2: modified
        
        manager.undo(); // back to empty
        
        updateUICallback.mockClear();
        requestDrawCallback.mockClear();
        
        manager.redo(); // forward to modified
        
        expect(manager.rooms).toEqual([{ id: 'room_1', name: 'Kitchen' }]);
        expect(manager.shortcuts).toEqual([{ id: 'sc_1', name: 'Lamp' }]);
        expect(manager.selectedRooms).toEqual([]);
        expect(updateUICallback).toHaveBeenCalledTimes(1);
        expect(requestDrawCallback).toHaveBeenCalledTimes(1);
    });

    it('should do nothing and not call callbacks if there is no redo state', () => {
        manager.saveState();
        updateUICallback.mockClear();
        requestDrawCallback.mockClear();
        
        manager.redo();
        
        expect(updateUICallback).not.toHaveBeenCalled();
        expect(requestDrawCallback).not.toHaveBeenCalled();
    });

    it('should toggle preview state index and request drawing', () => {
        expect(manager.previewStateIdx).toBe(-1);
        
        // Toggle on index 2
        let activeIdx = manager.togglePreviewState(2);
        expect(activeIdx).toBe(2);
        expect(manager.previewStateIdx).toBe(2);
        expect(requestDrawCallback).toHaveBeenCalledTimes(1);
        
        // Toggle off same index 2
        requestDrawCallback.mockClear();
        activeIdx = manager.togglePreviewState(2);
        expect(activeIdx).toBe(-1);
        expect(manager.previewStateIdx).toBe(-1);
        expect(requestDrawCallback).toHaveBeenCalledTimes(1);
        
        // Toggle to different index 5
        requestDrawCallback.mockClear();
        activeIdx = manager.togglePreviewState(5);
        expect(activeIdx).toBe(5);
        expect(manager.previewStateIdx).toBe(5);
        expect(requestDrawCallback).toHaveBeenCalledTimes(1);
    });

    it('should correctly update edit mode and reset selections when edit mode is disabled', () => {
        manager.isEditMode = true;
        manager.selectedRooms = ['room_1'];
        manager.selectedShortcutIdx = 3;
        
        updateUICallback.mockClear();
        requestDrawCallback.mockClear();
        
        manager.setEditMode(false);
        
        expect(manager.isEditMode).toBe(false);
        expect(manager.selectedRooms).toEqual([]);
        expect(manager.selectedShortcutIdx).toBe(-1);
        expect(updateUICallback).toHaveBeenCalledTimes(1);
        expect(requestDrawCallback).toHaveBeenCalledTimes(1);
    });

    it('should update edit mode and not reset selections when edit mode is enabled', () => {
        manager.isEditMode = false;
        manager.selectedRooms = ['room_1'];
        manager.selectedShortcutIdx = 3;
        
        updateUICallback.mockClear();
        requestDrawCallback.mockClear();
        
        manager.setEditMode(true);
        
        expect(manager.isEditMode).toBe(true);
        expect(manager.selectedRooms).toEqual(['room_1']);
        expect(manager.selectedShortcutIdx).toBe(3);
        expect(updateUICallback).toHaveBeenCalledTimes(1);
        expect(requestDrawCallback).toHaveBeenCalledTimes(1);
    });
});

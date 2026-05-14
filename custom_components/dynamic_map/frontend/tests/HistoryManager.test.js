import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../editor/HistoryManager.js';

describe('HistoryManager', () => {
    let historyManager;

    beforeEach(() => {
        historyManager = new HistoryManager();
    });

    it('should save initial state correctly', () => {
        const rooms = [{ id: 1, name: 'Living Room' }];
        const shortcuts = [{ id: 's1', type: 'light' }];
        
        historyManager.saveState(rooms, shortcuts);
        
        expect(historyManager.history.length).toBe(1);
        expect(historyManager.historyIndex).toBe(0);
        expect(historyManager.history[0].rooms).toEqual(rooms);
    });

    it('should correctly undo to a previous state', () => {
        const state1 = { rooms: [{ id: 1 }], shortcuts: [] };
        const state2 = { rooms: [{ id: 1 }, { id: 2 }], shortcuts: [] };
        
        historyManager.saveState(state1.rooms, state1.shortcuts);
        historyManager.saveState(state2.rooms, state2.shortcuts);
        
        expect(historyManager.history.length).toBe(2);
        
        const undoneState = historyManager.undo();
        expect(undoneState.rooms.length).toBe(1);
        expect(historyManager.historyIndex).toBe(0);
    });

    it('should return null when trying to undo from the initial state', () => {
        historyManager.saveState([], []);
        const undoneState = historyManager.undo();
        expect(undoneState).toBeNull();
    });

    it('should correctly redo after an undo', () => {
        const state1 = { rooms: [{ id: 1 }], shortcuts: [] };
        const state2 = { rooms: [{ id: 1 }, { id: 2 }], shortcuts: [] };
        
        historyManager.saveState(state1.rooms, state1.shortcuts);
        historyManager.saveState(state2.rooms, state2.shortcuts);
        
        historyManager.undo(); // back to state1
        const redoneState = historyManager.redo(); // forward to state2
        
        expect(redoneState.rooms.length).toBe(2);
        expect(historyManager.historyIndex).toBe(1);
    });

    it('should slice future history if saving state after undoing', () => {
        const state1 = { rooms: [{ id: 1 }], shortcuts: [] };
        const state2 = { rooms: [{ id: 1 }, { id: 2 }], shortcuts: [] };
        const state3 = { rooms: [{ id: 1 }, { id: 3 }], shortcuts: [] };
        
        historyManager.saveState(state1.rooms, state1.shortcuts); // idx 0
        historyManager.saveState(state2.rooms, state2.shortcuts); // idx 1
        
        historyManager.undo(); // back to idx 0
        
        // This should overwrite state2
        historyManager.saveState(state3.rooms, state3.shortcuts); // idx 1
        
        expect(historyManager.history.length).toBe(2);
        expect(historyManager.history[1].rooms[1].id).toBe(3);
    });

    it('should reset history completely', () => {
        historyManager.saveState([], []);
        historyManager.saveState([], []);
        historyManager.reset();
        
        expect(historyManager.history.length).toBe(0);
        expect(historyManager.historyIndex).toBe(-1);
    });
});

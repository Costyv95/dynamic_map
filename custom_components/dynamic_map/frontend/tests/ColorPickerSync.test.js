import { describe, it, expect, beforeEach } from 'vitest';

describe('Color Picker Synchronization', () => {
    let roomColorInput, roomColorText;
    let scColorInput, scColorText;
    let saveStateCalled = false;
    let requestDrawCalled = false;

    const stateMock = {
        selectedRooms: [0],
        rooms: [{ color: '#333333' }],
        selectedShortcutIdx: 0,
        shortcuts: [{ config: { color: '#0ea5e9' } }],
        saveState() { saveStateCalled = true; },
        requestDrawCallback() { requestDrawCalled = true; }
    };

    beforeEach(() => {
        saveStateCalled = false;
        requestDrawCalled = false;

        // Set up DOM elements in JSDOM
        document.body.innerHTML = `
            <input type="color" id="roomColor" value="#333333">
            <input type="text" id="roomColorText" value="#333333">
            <input type="color" id="scColor" value="#0ea5e9">
            <input type="text" id="scColorText" value="#0ea5e9">
        `;

        roomColorInput = document.getElementById('roomColor');
        roomColorText = document.getElementById('roomColorText');
        scColorInput = document.getElementById('scColor');
        scColorText = document.getElementById('scColorText');
    });

    it('should synchronize roomColor and roomColorText on valid hex input', () => {
        const syncRoomColor = (val) => {
            roomColorInput.value = val;
            roomColorText.value = val;
            stateMock.rooms[stateMock.selectedRooms[0]].color = val;
            stateMock.requestDrawCallback();
        };

        roomColorInput.addEventListener('input', (e) => syncRoomColor(e.target.value));
        roomColorText.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (/^#[0-9A-F]{6}$/i.test(val)) {
                syncRoomColor(val);
            }
        });
        roomColorText.addEventListener('change', (e) => {
            let val = e.target.value.trim();
            if (/^[0-9A-F]{6}$/i.test(val)) {
                val = '#' + val;
            }
            if (/^#[0-9A-F]{6}$/i.test(val)) {
                syncRoomColor(val);
                stateMock.saveState();
            } else {
                roomColorText.value = stateMock.rooms[stateMock.selectedRooms[0]].color || '#333333';
            }
        });

        // 1. Live type a valid color in text field
        roomColorText.value = '#ff0000';
        roomColorText.dispatchEvent(new window.Event('input'));

        expect(roomColorInput.value).toBe('#ff0000');
        expect(stateMock.rooms[0].color).toBe('#ff0000');
        expect(requestDrawCalled).toBe(true);

        // 2. Choose via color swatch picker
        requestDrawCalled = false;
        roomColorInput.value = '#00ff00';
        roomColorInput.dispatchEvent(new window.Event('input'));

        expect(roomColorText.value).toBe('#00ff00');
        expect(stateMock.rooms[0].color).toBe('#00ff00');
        expect(requestDrawCalled).toBe(true);

        // 3. Typo without hash prefix on change event
        saveStateCalled = false;
        roomColorText.value = '0000ff';
        roomColorText.dispatchEvent(new window.Event('change'));

        expect(roomColorInput.value).toBe('#0000ff');
        expect(roomColorText.value).toBe('#0000ff');
        expect(stateMock.rooms[0].color).toBe('#0000ff');
        expect(saveStateCalled).toBe(true);

        // 4. Invalid hex input should fall back on change
        roomColorText.value = 'invalid';
        roomColorText.dispatchEvent(new window.Event('change'));

        expect(roomColorText.value).toBe('#0000ff'); // falls back to last set valid color
    });

    it('should synchronize scColor and scColorText on valid hex input', () => {
        const syncScColor = (val) => {
            scColorInput.value = val;
            scColorText.value = val;
            stateMock.shortcuts[stateMock.selectedShortcutIdx].config.color = val;
            stateMock.requestDrawCallback();
        };

        scColorInput.addEventListener('input', (e) => syncScColor(e.target.value));
        scColorText.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (/^#[0-9A-F]{6}$/i.test(val)) {
                syncScColor(val);
            }
        });
        scColorText.addEventListener('change', (e) => {
            let val = e.target.value.trim();
            if (/^[0-9A-F]{6}$/i.test(val)) {
                val = '#' + val;
            }
            if (/^#[0-9A-F]{6}$/i.test(val)) {
                syncScColor(val);
                stateMock.saveState();
            } else {
                scColorText.value = stateMock.shortcuts[stateMock.selectedShortcutIdx].config?.color || '#0ea5e9';
            }
        });

        // 1. Live type a valid color in shortcut text field
        scColorText.value = '#10b981';
        scColorText.dispatchEvent(new window.Event('input'));

        expect(scColorInput.value).toBe('#10b981');
        expect(stateMock.shortcuts[0].config.color).toBe('#10b981');
        expect(requestDrawCalled).toBe(true);

        // 2. Choose via color swatch picker
        requestDrawCalled = false;
        scColorInput.value = '#f59e0b';
        scColorInput.dispatchEvent(new window.Event('input'));

        expect(scColorText.value).toBe('#f59e0b');
        expect(stateMock.shortcuts[0].config.color).toBe('#f59e0b');
        expect(requestDrawCalled).toBe(true);

        // 3. Typo without hash prefix on change event
        saveStateCalled = false;
        scColorText.value = 'ef4444';
        scColorText.dispatchEvent(new window.Event('change'));

        expect(scColorInput.value).toBe('#ef4444');
        expect(scColorText.value).toBe('#ef4444');
        expect(stateMock.shortcuts[0].config.color).toBe('#ef4444');
        expect(saveStateCalled).toBe(true);

        // 4. Invalid hex input should fall back on change
        scColorText.value = 'badhex';
        scColorText.dispatchEvent(new window.Event('change'));

        expect(scColorText.value).toBe('#ef4444'); // falls back to last set valid color
    });
});

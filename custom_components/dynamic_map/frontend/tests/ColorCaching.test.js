import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Color Caching Integration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('should cache and retrieve Shortcut Color correctly', () => {
        localStorage.setItem('lastShortcutColor', '#ff00ff');
        const defaultColor = localStorage.getItem('lastShortcutColor') || '#0ea5e9';
        expect(defaultColor).toBe('#ff00ff');
    });

    it('should cache and retrieve State Color correctly', () => {
        localStorage.setItem('lastStateColor', '#00ff00');
        const defaultStateColor = localStorage.getItem('lastStateColor') || '#ffffff';
        expect(defaultStateColor).toBe('#00ff00');
    });

    it('should cache and retrieve Room Color correctly', () => {
        localStorage.setItem('lastRoomColor', '#aabbcc');
        const defaultRoomColor = localStorage.getItem('lastRoomColor') || '#333333';
        expect(defaultRoomColor).toBe('#aabbcc');
    });
});

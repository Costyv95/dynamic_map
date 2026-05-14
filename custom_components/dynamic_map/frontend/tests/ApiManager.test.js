import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiManager } from '../shared/ApiManager.js';

describe('ApiManager', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fetchVacuumRooms', () => {
        it('should return fallback rooms when fetch fails entirely', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));
            
            const rooms = await ApiManager.fetchVacuumRooms('vacuum.test');
            
            expect(rooms.length).toBe(10); // Rooms 16 to 25
            expect(rooms[0].segId).toBe(16);
            expect(rooms[9].segId).toBe(25);
        });

        it('should correctly parse segment IDs from vacuum attributes', async () => {
            global.fetch.mockImplementation((url) => {
                if (url.includes('/api/dynamic_map/state?entity_id=vacuum.test')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            success: true,
                            attributes: {
                                rooms: {
                                    "16": "Kitchen",
                                    "17": "Living Room"
                                }
                            }
                        })
                    });
                }
                return Promise.resolve({ ok: false });
            });

            const rooms = await ApiManager.fetchVacuumRooms('vacuum.test');
            
            expect(rooms.length).toBe(2);
            expect(rooms.some(r => r.name === 'Kitchen' && r.segId === 16)).toBe(true);
            expect(rooms.some(r => r.name === 'Living Room' && r.segId === 17)).toBe(true);
        });
    });

    describe('fetchFloorData', () => {
        it('should correctly fetch rooms, shortcuts, and config for a given floor', async () => {
            global.fetch.mockImplementation((url) => {
                if (url.includes('rooms_floor1.json')) {
                    return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'r1' }]) });
                }
                if (url.includes('shortcuts_floor1.json')) {
                    return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 's1' }]) });
                }
                if (url.includes('config_floor1.json')) {
                    return Promise.resolve({ ok: true, json: () => Promise.resolve({ rotation_mode: 'vertical' }) });
                }
                return Promise.reject(new Error('Not found'));
            });

            const data = await ApiManager.fetchFloorData(1);
            
            expect(data.rooms.length).toBe(1);
            expect(data.shortcuts.length).toBe(1);
            expect(data.config.rotation_mode).toBe('vertical');
        });
    });

    describe('saveToHA', () => {
        it('should successfully save multiple JSON files to Home Assistant', async () => {
            global.fetch.mockResolvedValue({ ok: true, statusText: 'OK' });
            
            const result = await ApiManager.saveToHA(1, [{ id: 'r1' }], [{ id: 's1' }], { rotation_mode: 'auto' });
            
            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('should throw an error if saving rooms fails', async () => {
            global.fetch.mockResolvedValueOnce({ ok: false, statusText: 'Internal Server Error' });
            
            await expect(ApiManager.saveToHA(1, [], [], {})).rejects.toThrow('Rooms save failed: Internal Server Error');
        });
    });
});

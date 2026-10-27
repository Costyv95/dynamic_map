import { describe, it, expect } from 'vitest';
import fx from './fixtures/area_room_cases.json';
import { roomForState, roomForPresence } from '../card/PresenceLayer.js';

// Shared with tests/test_position_math.py: card and backend must agree (#1708).
const areas = Object.fromEntries(Object.entries(fx.area_names).map(([id, name]) => [id, { name }]));

describe('area -> room matches the backend', () => {
    it.each(fx.cases)('$state', ({ state, expect: want }) => {
        if (want === null) {
            for (const rooms of Object.values(fx.rooms_by_floor)) expect(roomForState(rooms, state, areas)).toBe(null);
            return;
        }
        // On the floor the backend picks, the card shows the backend's room.
        const [floor, id] = want;
        expect(roomForState(fx.rooms_by_floor[floor], state, areas)?.id).toBe(id);
    });
});

describe('roomForPresence', () => {
    const rooms = fx.rooms_by_floor['2'];
    const st = { state: 'Office', attributes: { floor: 3, room_id: 'f3_office', source: 'room' } };
    it('uses the backend room_id, not the state name', () => {
        expect(roomForPresence(fx.rooms_by_floor['3'], st, areas, 3).id).toBe('f3_office');
    });
    it('hides on another floor even when the name matches here', () => {
        expect(roomForPresence(rooms, st, areas, 2)).toBeUndefined();
    });
    it('falls back to the state for a plain area sensor', () => {
        expect(roomForPresence(rooms, { state: 'Study', attributes: {} }, areas, 2).id).toBe('f2_office');
    });
});

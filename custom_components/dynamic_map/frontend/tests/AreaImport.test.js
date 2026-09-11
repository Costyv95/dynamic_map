import { describe, it, expect, vi } from 'vitest';
import { unplacedAreaEntities, gridInRoom, badgeFor, importArea, importOne, selectBadge, renderAreaImport, placedEntities } from '../editor/ui/AreaImport.js';

const room = { id: 'r1', name: 'Office', area_id: 'office', polygon: [[10, 10], [50, 10], [50, 40], [10, 40]] };
function makeHass() {
    return {
        entities: { 'light.desk': { area_id: 'office' }, 'switch.fan': { area_id: 'office' }, 'sensor.temp': { area_id: 'office' }, 'sensor.power': { area_id: 'office' }, 'light.kitchen': { area_id: 'kitchen' } },
        devices: {},
        states: {
            'light.desk': { state: 'on', attributes: { friendly_name: 'Desk lamp' } },
            'switch.fan': { state: 'off', attributes: { friendly_name: 'Fan' } },
            'sensor.temp': { state: '21', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
            'sensor.power': { state: '5', attributes: { unit_of_measurement: 'W' } },
            'light.kitchen': { state: 'off', attributes: {} }
        }
    };
}

describe('area import', () => {
    it('lists controllable and temperature entities of the area that are not placed yet', () => {
        const placed = [{ id: 'x', entity_id: 'light.desk', config: {} }];
        expect(unplacedAreaEntities(makeHass(), room, placed)).toEqual(['switch.fan', 'sensor.temp']);
        expect(unplacedAreaEntities(null, room, [])).toEqual([]);
        expect(placedEntities([{ config: { temperature_entity: 'sensor.t' } }]).has('sensor.t')).toBe(true);
    });

    it('lays points out in a grid inside the room', () => {
        const pts = gridInRoom(room, 4, 1000, 1000);
        expect(pts.length).toBe(4);
        pts.forEach(([x, y]) => { expect(x).toBeGreaterThan(10); expect(x).toBeLessThan(50); expect(y).toBeGreaterThan(10); expect(y).toBeLessThan(40); });
        expect(new Set(pts.map(p => p.join(','))).size).toBe(4);
    });

    it('builds typed badges with presets', () => {
        const h = makeHass();
        const light = badgeFor(h, 'light.desk', [20, 20], 'r1');
        expect(light).toMatchObject({ type: 'light', entity_id: 'light.desk', name: 'Desk lamp', parent: 'r1' });
        expect(light.config.actions[0].type).toBe('TOGGLE');
        const sensor = badgeFor(h, 'sensor.temp', [20, 20], 'r1');
        expect(sensor.type).toBe('sensor');
        expect(sensor.config.temperature_entity).toBe('sensor.temp');
        const sw = badgeFor(h, 'switch.fan', [20, 20], 'r1');
        expect(sw.type).toBe('generic');
        expect(sw.config.actions[0]).toMatchObject({ type: 'TOGGLE', action_entity: 'switch.fan' });
    });

    it('importArea adds the badges, saves, and reports the count', () => {
        const state = { shortcuts: [], saveState: vi.fn(), requestDrawCallback: vi.fn() };
        const ctx = { state, canvas: { _hass: makeHass(), imgW: 1000, imgH: 1000 }, refresh: vi.fn() };
        expect(importArea(ctx, room)).toBe(3);
        expect(state.shortcuts.map(s => s.entity_id)).toEqual(['light.desk', 'switch.fan', 'sensor.temp']);
        expect(state.saveState).toHaveBeenCalled();
        expect(importArea(ctx, room)).toBe(0);
    });

    it('lists every device of the area; ＋ places one badge and jumps to it, placed rows select their badge', () => {
        const state = { shortcuts: [{ id: 'sc1', entity_id: 'light.desk', position: [20, 20], config: {} }], activeLayer: 'rooms', selectedShortcutIdx: -1, selectedExtra: [],
            saveState: vi.fn(), requestDrawCallback: vi.fn(), setActiveLayer(l) { this.activeLayer = l; } };
        const ctx = { state, canvas: { _hass: makeHass(), imgW: 1000, imgH: 1000 }, refresh: vi.fn(), select: vi.fn() };
        const sec = renderAreaImport(ctx, room);
        const rows = [...sec.querySelectorAll('.dm-device-list .dm-list-item')];
        expect(rows.map(r => r.title)).toEqual(['light.desk', 'switch.fan', 'sensor.power', 'sensor.temp']);
        expect(rows[0].textContent).toContain('on map');
        expect(rows[2].querySelector('button')).toBeNull();          // plain sensors stay in the card's room panel
        rows[1].querySelector('button').click();                     // add the fan
        expect(state.shortcuts.map(s => s.entity_id)).toEqual(['light.desk', 'switch.fan']);
        expect(state.activeLayer).toBe('objects');
        expect(state.selectedShortcutIdx).toBe(1);
        expect(ctx.select).toHaveBeenCalled();
        rows[0].click();                                             // jump to the lamp badge
        expect(state.selectedShortcutIdx).toBe(0);
        expect(selectBadge(ctx, 'nope')).toBe(false);
        expect(sec.querySelector('button.primary').textContent).toContain('Add all 2');
    });
});

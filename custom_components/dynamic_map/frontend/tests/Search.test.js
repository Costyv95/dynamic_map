import { describe, it, expect, vi } from 'vitest';
import { indexFloor, matchIndex } from '../card/SearchIndex.js';
import { buildSearch, openSearch, goTo, focusBadge } from '../card/Search.js';
import { buildRoomPanelEl } from '../card/RoomPanel.js';

const hass = {
    entities: { 'light.desk': { area_id: 'office' }, 'switch.fan': { area_id: 'office' }, 'sensor.diag': { area_id: 'office', entity_category: 'diagnostic' } },
    devices: {},
    states: { 'light.desk': { state: 'on', attributes: { friendly_name: 'Desk lamp' } }, 'switch.fan': { state: 'off', attributes: { friendly_name: 'Ceiling fan' } }, 'sensor.diag': { state: '1', attributes: {} } },
    callService: vi.fn()
};
const rooms = [{ id: 'r1', name: 'Office', area_id: 'office', polygon: [[10, 10], [50, 10], [50, 40], [10, 40]] }];
const shortcuts = [{ id: 's1', name: 'Projector', type: 'media', entity_id: 'media_player.proj', position: [30, 30], scaleX: 1, scaleY: 1, config: {} }, { id: 's2', type: 'light', entity_id: 'light.desk', position: [20, 20], config: { icon: '💡' } }];

describe('search index', () => {
    it('indexes badges, rooms and unplaced area entities with floor labels, and ranks matches', () => {
        const entries = indexFloor(2, { rooms, shortcuts }, hass, f => `Level ${f}`);
        expect(entries.map(e => `${e.kind}:${e.name}`)).toEqual(['badge:Projector', 'badge:Desk lamp', 'room:Office', 'entity:Ceiling fan']);
        expect(entries[1].icon).toBe('💡');
        expect(entries[3].sub).toBe('Office · Level 2');
        expect(matchIndex(entries, 'fan').map(e => e.name)).toEqual(['Ceiling fan']);
        expect(matchIndex(entries, 'o').map(e => e.name)).toEqual(['Office', 'Projector']);   // prefix first, then word start
        expect(matchIndex(entries, 'light.d').map(e => e.name)).toEqual(['Desk lamp']);        // entity id substring
        expect(matchIndex(entries, '')).toEqual([]);
    });
});

function makeHost() {
    const renderRoot = document.createElement('div');
    const topLeftUI = document.createElement('div');
    renderRoot.appendChild(topLeftUI);
    document.body.appendChild(renderRoot);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const host = {
        renderRoot, topLeftUI, rooms, shortcuts, _hass: hass, config: { floors: [1, 2] }, activeFloor: 2, imgW: 1000, imgH: 1000, activeMode: 'horizontal',
        floorLabel: f => `Floor ${f}`, mapPointToView: (x, y) => ({ x, y }), getBoundingClientRect: () => ({ width: 400, height: 200 }),
        animateViewBox: vi.fn(), zoomToRoom: vi.fn(), updateRoomStyles: vi.fn(), zoomOutToDefault: vi.fn(), dispatchEvent: vi.fn(),
        shortcutElements: { s1: { group } }, loadData: vi.fn(), whenBuilt: vi.fn(() => Promise.resolve())
    };
    buildRoomPanelEl(host);
    return host;
}

describe('search UI', () => {
    it('opens from the 🔍 button, filters as you type, and jumps to a badge with a pulse', async () => {
        const host = makeHost();
        buildSearch(host);
        host.topLeftUI.querySelector('.dm-search-btn').click();
        const box = host.renderRoot.querySelector('.dm-search');
        const input = box.querySelector('input');
        input.value = 'proj';
        input.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 0));
        const row = box.querySelector('.dm-search-row');
        expect(row.textContent).toContain('Projector');
        row.click();
        expect(host.renderRoot.querySelector('.dm-search')).toBeNull();
        expect(host.animateViewBox).toHaveBeenCalled();
        const vb = host.animateViewBox.mock.calls[0][0];
        expect(vb.w / vb.h).toBeCloseTo(2, 3);                              // card aspect
        expect(vb.x + vb.w / 2).toBeCloseTo(300, 3);                        // centred on the badge (30% of 1000)
        expect(host.shortcutElements.s1.group.querySelector('.dm-pulse')).toBeTruthy();
    });

    it('a room result zooms to the room and opens its panel; another floor is loaded first', async () => {
        const host = makeHost();
        await goTo(host, { kind: 'room', floor: 2, id: 'r1' });
        expect(host.zoomToRoom).toHaveBeenCalledWith(rooms[0]);
        expect(host.roomPanel.classList.contains('dm-visible')).toBe(true);
        await goTo(host, { kind: 'entity', floor: 1, id: 'light.x', roomId: 'r1' });
        expect(host.loadData).toHaveBeenCalled();
        expect(host.activeFloor).toBe(1);
        expect(focusBadge(host, 'nope')).toBe(false);
        const box = openSearch(host);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(box.isConnected).toBe(false);
    });
});

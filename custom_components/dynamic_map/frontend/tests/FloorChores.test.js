import { describe, it, expect, vi } from 'vitest';
import { choreTint } from '../card/Chores.js';
import { buildChoresMode, setMapMode } from '../card/ChoresMode.js';
import { updateRoomStyles } from '../core/RoomStyles.js';
import { buildRoomPanelEl, updateRoomPanel } from '../card/RoomPanel.js';
import { onRoomTap } from '../card/RoomFocus.js';
import { floorChoreAreas, floorWords } from '../card/FloorChores.js';

const svgNS = 'http://www.w3.org/2000/svg';
const people = [{ id: 7, name: 'Costin' }];
const chore = (id, title, extra = {}) => ({ id, title, due: false, late_days: 0, due_on: '2026-11-30', ...extra });

function makeHass() {
    return {
        areas: { stairs: { name: 'Stairs', floor_id: 'floor_2' }, landing: { name: 'Landing', floor_id: 'floor_2' }, terrace: { name: 'Terrace', floor_id: 'floor_3' } },
        floors: {}, entities: {}, devices: {},
        states: {
            'sensor.crumbs_house_chores': { state: '0', attributes: { due: 2, areas: {
                kitchen: { room: 'Kitchen', due: 0, overdue: 0, people, chores: [chore(1, 'Scrub counters')] },
                stairs: { room: 'Stairs', due: 1, overdue: 0, people, chores: [chore(2, 'Dust and mop', { due: true })] },
                second_floor: { room: 'Second floor', due: 1, overdue: 0, people, chores: [chore(3, 'Mop', { due: true }), chore(4, 'Tidy up')] },
                landing: { room: 'Landing', due: 0, overdue: 0, people, chores: [chore(5, 'Sweep')] },
                terrace: { room: 'Terrace', due: 0, overdue: 0, people, chores: [chore(6, 'Water')] },
                upstairs_extra: { room: 'Attic', due: 0, overdue: 0, people, chores: [] }
            } } }
        },
        callService: vi.fn(() => Promise.resolve())
    };
}
const square = [[10, 10], [50, 10], [50, 30], [10, 30]];
const rooms = [
    { id: 'k', name: 'Kitchen', area_id: 'kitchen', polygon: square },
    { id: 's', name: 'Stairs', area_id: 'stairs', polygon: square }
];

function makeHost(hass, width = 1000) {
    const renderRoot = document.createElement('div');
    const mapRoot = document.createElementNS(svgNS, 'g');
    rooms.forEach(() => { const p = document.createElementNS(svgNS, 'polygon'); p.classList.add('room-polygon'); mapRoot.appendChild(p); });
    const host = Object.assign(new EventTarget(), {
        svgNS, renderRoot, topLeftUI: document.createElement('div'), mapRoot, rooms, imgW: 1000, imgH: 1000,
        config: {}, _hass: hass, activeFloor: '2', floorLabel: (n) => `Floor ${n}`,
        zoomOutToDefault: vi.fn(), zoomToRoom: vi.fn(), syncFocusPill: vi.fn(),
        getBoundingClientRect: () => ({ width, height: 600 })
    });
    host.roomTint = (room) => (host.mapMode === 'chores' ? choreTint(host, host._hass, room) : null);
    host.updateRoomStyles = () => updateRoomStyles(host);
    host.refreshRoomPanel = () => updateRoomPanel(host, host._hass);
    host.onRoomTap = (room) => onRoomTap(host, room);
    buildRoomPanelEl(host);
    buildChoresMode(host);
    setMapMode(host, 'chores');
    return host;
}
const floorChip = (host) => host.choresLegend.querySelector('.dm-cl-floor');
const panelOpen = (host) => host.roomPanel.classList.contains('dm-visible');

describe('floor-wide chores', () => {
    it('names a floor by ordinal, number and label', () => {
        const w = floorWords({ floorLabel: () => 'Upstairs' }, '2');
        ['second floor', '2nd floor', 'floor 2', 'upstairs'].forEach(x => expect(w.has(x)).toBe(true));
        expect(floorWords({}, '3').has('3rd floor')).toBe(true);
    });

    it('takes unmatched areas named after the floor or on its HA floor, not rooms or other floors', () => {
        const host = makeHost(makeHass());
        expect(floorChoreAreas(host, host._hass).map(a => a.key)).toEqual(['second_floor', 'landing']);
        host.activeFloor = '3';
        expect(floorChoreAreas(host, host._hass).map(a => a.key)).toEqual(['terrace']);
        setMapMode(host, 'lights');
        expect(floorChoreAreas(host, host._hass)).toEqual([]);
    });

    it('puts a Whole floor chip in the legend that opens the list docked, with Done buttons', () => {
        const hass = makeHass();
        const host = makeHost(hass);
        const chip = floorChip(host);
        expect(chip.textContent).toContain('Whole floor · 1');
        expect(panelOpen(host)).toBe(false);
        chip.click();
        expect(panelOpen(host)).toBe(true);
        expect(host.renderRoot.classList.contains('dm-chores-dock')).toBe(true);
        const subs = [...host.roomPanel.querySelectorAll('.dm-rp-subhead')].map(s => s.textContent);
        expect(subs).toEqual(['Second floor', 'Landing']);
        const titles = [...host.roomPanel.querySelectorAll('.dm-chore-title')].map(t => t.textContent);
        expect(titles).toEqual(['Mop', 'Tidy up', 'Sweep']);
        host.roomPanel.querySelector('.dm-chore-done').click();
        expect(hass.callService).toHaveBeenCalledWith('crumbs', 'complete_chore', { task_id: 3, done_by: 7 });
        expect(host.roomPanel.querySelector('.dm-chore-done').disabled).toBe(true);   // re-rendered busy
    });

    it('closes on ✕ without zooming, gives way to a room tap and to Lights mode', () => {
        const host = makeHost(makeHass(), 400);
        floorChip(host).click();
        expect(host.renderRoot.classList.contains('dm-chores-dock')).toBe(false);   // phone sheet
        host.roomPanel.querySelector('.dm-rp-close').click();
        expect(panelOpen(host)).toBe(false);
        expect(host.zoomOutToDefault).not.toHaveBeenCalled();
        floorChip(host).click();
        host.onRoomTap(rooms[1]);
        expect(host.roomPanel.querySelector('.dm-rp-title').textContent).toContain('Stairs');
        expect(host._floorChoresOpen).toBe(false);
        const other = makeHost(makeHass());
        floorChip(other).click();
        setMapMode(other, 'lights');
        expect(panelOpen(other)).toBe(false);
        setMapMode(other, 'chores');
        expect(panelOpen(other)).toBe(false);
    });

    it('shows one area under its own name and no chip when nothing is floor-wide', () => {
        const hass = makeHass();
        const a = hass.states['sensor.crumbs_house_chores'].attributes.areas;
        delete a.landing;
        const host = makeHost(hass);
        floorChip(host).click();
        expect(host.roomPanel.querySelector('.dm-rp-title').textContent).toBe('🏠 Second floor');
        delete a.second_floor;
        const bare = makeHost(hass);
        expect(floorChip(bare)).toBe(null);
    });
});
